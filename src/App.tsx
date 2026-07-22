import { useEffect, useMemo, useRef, useState } from "react";
import {
  LOCALES,
  createTranslator,
  localeTag,
  useI18n,
  type Locale,
} from "./i18n";
import { computeTvaTtc, round2, toNumber } from "./lib/amounts";
import {
  clearAutosave,
  loadAutosave,
  writeAutosave,
} from "./lib/autosave";
import {
  hasCompanyProfile,
  headerFromCompanyProfile,
  loadCompanyProfile,
  saveCompanyProfile,
} from "./lib/companyProfile";
import { saveBinaryFile, saveTextFile } from "./lib/download";
import { buildZipBlob } from "./lib/zip";
import { translateValidation } from "./lib/i18nErrors";
import {
  buildCsv,
  buildExcelBlob,
  buildTemplateRows,
  parseCsv,
  parseExcel,
} from "./lib/io";
import {
  buildNonResidentCsv,
  buildNonResidentExcelBlob,
  buildNonResidentTemplateRows,
  generateNonResidentXml,
  isNonResidentXml,
  parseNonResidentCsv,
  parseNonResidentExcel,
  parseNonResidentXml,
  validateNonResidentXml,
} from "./lib/nonResidents";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  detectKind,
  formatRecentLabel,
  loadRecentImports,
  pushRecentImport,
  type RecentImportedFile,
} from "./lib/recentFiles";
import { generateXml, parseXml, validateForXml } from "./lib/xml";
import {
  DEFAULT_COMPANY_PROFILE,
  createDefaultHeader,
  createEmptyNonResidentRow,
  createEmptyRow,
  defaultPeriodForRegime,
  type AppMode,
  type CompanyProfile,
  type DeclarationHeader,
  type DeductionRow,
  type NonResidentRow,
} from "./types";
import "./App.css";

type MenuKey = "fichier" | "modele" | "export" | "config" | null;
type Status = { type: "ok" | "err" | "info"; text: string } | null;

function formatClock(locale: Locale, iso: string) {
  return new Date(iso).toLocaleTimeString(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function initialState() {
  const profile = loadCompanyProfile();
  const saved = loadAutosave();
  if (saved) {
    return {
      mode: saved.mode ?? ("non_residents" as AppMode),
      header: {
        ...headerFromCompanyProfile(profile, createDefaultHeader()),
        ...saved.header,
      },
      rows:
        saved.rows?.length > 0
          ? saved.rows
          : [createEmptyRow(1, saved.header?.modePaiementId ?? "7")],
      nrRows:
        saved.nrRows?.length > 0
          ? saved.nrRows
          : [createEmptyNonResidentRow(1)],
      showAdvanced: Boolean(saved.showAdvanced),
      restoredAt: saved.savedAt,
      profile,
    };
  }
  return {
    mode: "non_residents" as AppMode,
    header: headerFromCompanyProfile(profile, createDefaultHeader()),
    rows: [createEmptyRow(1)],
    nrRows: [createEmptyNonResidentRow(1)],
    showAdvanced: false,
    restoredAt: null as string | null,
    profile,
  };
}

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const boot = useMemo(() => initialState(), []);
  const [mode, setMode] = useState<AppMode>(boot.mode);
  const [header, setHeader] = useState<DeclarationHeader>(boot.header);
  const [rows, setRows] = useState<DeductionRow[]>(boot.rows);
  const [nrRows, setNrRows] = useState<NonResidentRow[]>(boot.nrRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [status, setStatus] = useState<Status>(null);
  const [showAdvanced, setShowAdvanced] = useState(boot.showAdvanced);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    boot.restoredAt,
  );
  const [draftRestored, setDraftRestored] = useState(Boolean(boot.restoredAt));
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(
    boot.profile,
  );
  const [draftProfile, setDraftProfile] = useState<CompanyProfile>(boot.profile);
  const [showConfig, setShowConfig] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentImportedFile[]>(() =>
    loadRecentImports(),
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  const skipFirstSave = useRef(true);

  const activeIds =
    mode === "releve" ? rows.map((r) => r.id) : nrRows.map((r) => r.id);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        mht: acc.mht + toNumber(r.mht),
        tva: acc.tva + toNumber(r.tva),
        ttc: acc.ttc + toNumber(r.ttc),
      }),
      { mht: 0, tva: 0, ttc: 0 },
    );
  }, [rows]);

  const nrTotals = useMemo(() => {
    return nrRows.reduce(
      (acc, r) => ({
        base: acc.base + toNumber(r.baseImposable),
        tva: acc.tva + toNumber(r.tvaExigible),
      }),
      { base: 0, tva: 0 },
    );
  }, [nrRows]);

  useEffect(() => {
    if (boot.restoredAt) {
      flash("info", t("toast.draftRestored"));
    }
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot.restoredAt]);

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const savedAt = writeAutosave({
        mode,
        header,
        rows,
        nrRows,
        showAdvanced,
      });
      setLastSavedAt(savedAt);
      setDraftRestored(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [mode, header, rows, nrRows, showAdvanced]);

  function flash(type: "ok" | "err" | "info", text: string) {
    setStatus({ type, text });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setStatus(null), 4500);
  }

  function switchMode(next: AppMode) {
    if (next === mode) return;
    setMode(next);
    setSelected(new Set());
    setOpenMenu(null);
  }

  function renumber(list: DeductionRow[]): DeductionRow[] {
    return list.map((r, i) => ({ ...r, ordre: i + 1 }));
  }

  function renumberNr(list: NonResidentRow[]): NonResidentRow[] {
    return list.map((r, i) => ({ ...r, ordre: i + 1 }));
  }

  function updateHeader<K extends keyof DeclarationHeader>(
    key: K,
    value: DeclarationHeader[K],
  ) {
    setHeader((h) => ({ ...h, [key]: value }));
  }

  function updateCell(id: string, field: keyof DeductionRow, raw: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        if (field === "mht" || field === "tx" || field === "tva" || field === "ttc") {
          const next: DeductionRow = { ...row };
          next[field] = raw.trim() === "" ? "" : round2(toNumber(raw));
          if ((field === "mht" || field === "tx") && next.mht !== "" && next.tx !== "") {
            const calc = computeTvaTtc(toNumber(next.mht), toNumber(next.tx));
            next.tva = calc.tva;
            next.ttc = calc.ttc;
          }
          return next;
        }

        if (field === "ordre") {
          return { ...row, ordre: Number(raw) || row.ordre };
        }

        return { ...row, [field]: raw };
      }),
    );
  }

  function updateNrCell(id: string, field: keyof NonResidentRow, raw: string) {
    setNrRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        if (
          field === "baseImposable" ||
          field === "taux" ||
          field === "tvaExigible"
        ) {
          const next: NonResidentRow = { ...row };
          next[field] = raw.trim() === "" ? "" : round2(toNumber(raw));
          if (
            (field === "baseImposable" || field === "taux") &&
            next.baseImposable !== "" &&
            next.taux !== ""
          ) {
            next.tvaExigible = round2(
              (toNumber(next.baseImposable) * toNumber(next.taux)) / 100,
            );
          }
          return next;
        }

        if (field === "ordre") {
          return { ...row, ordre: Number(raw) || row.ordre };
        }

        return { ...row, [field]: raw };
      }),
    );
  }

  function addRow() {
    if (mode === "releve") {
      setRows((prev) => [
        ...prev,
        createEmptyRow(prev.length + 1, header.modePaiementId),
      ]);
    } else {
      setNrRows((prev) => [...prev, createEmptyNonResidentRow(prev.length + 1)]);
    }
  }

  function askDeleteRow(id: string, label: string) {
    setPendingDelete({
      ids: [id],
      label: label.trim() || t("row.thisLine"),
    });
  }

  function askDeleteSelected() {
    if (selected.size < 2) return;
    setPendingDelete({
      ids: [...selected],
      label: t("action.deleteSelected", { count: selected.size }),
    });
  }

  function confirmDeleteRow() {
    if (!pendingDelete) return;
    const { ids } = pendingDelete;
    const idSet = new Set(ids);
    if (mode === "releve") {
      setRows((prev) => {
        const next = renumber(prev.filter((r) => !idSet.has(r.id)));
        return next.length ? next : [createEmptyRow(1, header.modePaiementId)];
      });
    } else {
      setNrRows((prev) => {
        const next = renumberNr(prev.filter((r) => !idSet.has(r.id)));
        return next.length ? next : [createEmptyNonResidentRow(1)];
      });
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setPendingDelete(null);
    flash(
      "ok",
      ids.length > 1
        ? t("toast.rowsDeleted", { count: ids.length })
        : t("toast.rowDeleted"),
    );
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === activeIds.length ? new Set() : new Set(activeIds),
    );
  }

  async function applyImport(options: {
    fileName: string;
    kind: "csv" | "xlsx" | "xml";
    text?: string;
    buffer?: ArrayBuffer;
    modeHint: AppMode;
    remember?: boolean;
  }) {
    const { fileName, kind, text, buffer, modeHint, remember = true } = options;

    if (kind === "xml") {
      const content = text ?? "";
      const asNonResidents =
        isNonResidentXml(content) || modeHint === "non_residents";
      if (asNonResidents) {
        const parsed = parseNonResidentXml(content);
        setHeader((h) => ({ ...h, ...parsed.header }));
        setNrRows(
          parsed.rows.length ? parsed.rows : [createEmptyNonResidentRow(1)],
        );
        setMode("non_residents");
        flash(
          "ok",
          t("toast.xmlNrImported", { count: parsed.rows.length }),
        );
      } else {
        const parsed = parseXml(content);
        setHeader((h) => ({ ...h, ...parsed.header }));
        setRows(
          parsed.rows.length
            ? parsed.rows
            : [createEmptyRow(1, header.modePaiementId)],
        );
        setMode("releve");
        flash(
          "ok",
          t("toast.xmlReleveImported", { count: parsed.rows.length }),
        );
      }
      if (remember) {
        setRecentFiles(
          pushRecentImport({
            name: fileName,
            kind: "xml",
            payload: content,
            modeHint: asNonResidents ? "non_residents" : "releve",
          }),
        );
      }
      return;
    }

    if (kind === "csv") {
      const content = text ?? "";
      if (modeHint === "non_residents") {
        const parsed = parseNonResidentCsv(content);
        setNrRows(
          parsed.length ? renumberNr(parsed) : [createEmptyNonResidentRow(1)],
        );
        flash("ok", t("toast.csvImported", { count: parsed.length }));
      } else {
        const parsed = parseCsv(content);
        setRows(parsed.length ? renumber(parsed) : [createEmptyRow(1)]);
        flash("ok", t("toast.csvImported", { count: parsed.length }));
      }
      if (remember) {
        setRecentFiles(
          pushRecentImport({
            name: fileName,
            kind: "csv",
            payload: content,
            modeHint,
          }),
        );
      }
      return;
    }

    const excelBuffer = buffer ?? new ArrayBuffer(0);
    if (modeHint === "non_residents") {
      const parsed = parseNonResidentExcel(excelBuffer);
      setNrRows(
        parsed.length ? renumberNr(parsed) : [createEmptyNonResidentRow(1)],
      );
      flash("ok", t("toast.excelImported", { count: parsed.length }));
    } else {
      const parsed = parseExcel(excelBuffer);
      setRows(parsed.length ? renumber(parsed) : [createEmptyRow(1)]);
      flash("ok", t("toast.excelImported", { count: parsed.length }));
    }
    if (remember) {
      setRecentFiles(
        pushRecentImport({
          name: fileName,
          kind: "xlsx",
          payload: arrayBufferToBase64(excelBuffer),
          modeHint,
        }),
      );
    }
  }

  async function onImportFile(file: File) {
    try {
      const kind = detectKind(file.name);
      if (!kind) {
        flash("err", t("toast.badFormat"));
        return;
      }
      if (kind === "xlsx") {
        const buffer = await file.arrayBuffer();
        await applyImport({
          fileName: file.name,
          kind,
          buffer,
          modeHint: mode,
        });
      } else {
        const text = await file.text();
        await applyImport({
          fileName: file.name,
          kind,
          text,
          modeHint: mode,
        });
      }
    } catch (e) {
      flash("err", e instanceof Error ? e.message : t("toast.importFailed"));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      setOpenMenu(null);
    }
  }

  async function reopenRecent(entry: RecentImportedFile) {
    try {
      if (entry.kind === "xlsx") {
        await applyImport({
          fileName: entry.name,
          kind: "xlsx",
          buffer: base64ToArrayBuffer(entry.payload),
          modeHint: entry.modeHint,
        });
      } else {
        await applyImport({
          fileName: entry.name,
          kind: entry.kind,
          text: entry.payload,
          modeHint: entry.modeHint,
        });
      }
    } catch (e) {
      flash("err", e instanceof Error ? e.message : t("toast.reopenFailed"));
    } finally {
      setOpenMenu(null);
    }
  }

  async function downloadTemplate(format: "csv" | "xlsx") {
    if (mode === "non_residents") {
      const sample = buildNonResidentTemplateRows();
      if (format === "csv") {
        await saveTextFile(
          "modele_non_residents.csv",
          buildNonResidentCsv(sample),
          [{ name: "CSV", extensions: ["csv"] }],
        );
      } else {
        await saveBinaryFile(
          "modele_non_residents.xlsx",
          buildNonResidentExcelBlob(sample),
          [{ name: "Excel", extensions: ["xlsx"] }],
        );
      }
    } else {
      const sample = buildTemplateRows();
      if (format === "csv") {
        await saveTextFile(
          "modele_releve_deductions.csv",
          buildCsv(sample, true),
          [{ name: "CSV", extensions: ["csv"] }],
        );
      } else {
        await saveBinaryFile(
          "modele_releve_deductions.xlsx",
          buildExcelBlob(sample, true),
          [{ name: "Excel", extensions: ["xlsx"] }],
        );
      }
    }
    flash(
      "ok",
      t("toast.templateDownloaded", { format: format.toUpperCase() }),
    );
    setOpenMenu(null);
  }

  async function exportCsv() {
    if (mode === "non_residents") {
      await saveTextFile(
        `non_residents_${header.annee}_P${header.periode}.csv`,
        buildNonResidentCsv(nrRows),
        [{ name: "CSV", extensions: ["csv"] }],
      );
    } else {
      await saveTextFile(
        `releve_deductions_${header.annee}_P${header.periode}.csv`,
        buildCsv(rows, false),
        [{ name: "CSV", extensions: ["csv"] }],
      );
    }
    flash("ok", t("toast.exportCsvDone"));
    setOpenMenu(null);
  }

  async function exportExcel() {
    if (mode === "non_residents") {
      await saveBinaryFile(
        `non_residents_${header.annee}_P${header.periode}.xlsx`,
        buildNonResidentExcelBlob(nrRows),
        [{ name: "Excel", extensions: ["xlsx"] }],
      );
    } else {
      await saveBinaryFile(
        `releve_deductions_${header.annee}_P${header.periode}.xlsx`,
        buildExcelBlob(rows, false),
        [{ name: "Excel", extensions: ["xlsx"] }],
      );
    }
    flash("ok", t("toast.exportExcelDone"));
    setOpenMenu(null);
  }

  async function exportXml() {
    if (mode === "non_residents") {
      const errors = validateNonResidentXml(header, nrRows);
      if (errors.length) {
        flash("err", translateValidation(t, errors[0]));
        setOpenMenu(null);
        return;
      }
      const xml = generateNonResidentXml(header, nrRows);
      await saveTextFile(
        `DeclarationNonResidents_${header.idf}_${header.annee}_P${header.periode}.xml`,
        xml,
        [{ name: "XML", extensions: ["xml"] }],
      );
    } else {
      const errors = validateForXml(header, rows);
      if (errors.length) {
        flash("err", translateValidation(t, errors[0]));
        setOpenMenu(null);
        return;
      }
      const prepared = rows.map((r) => ({
        ...r,
        dpai: r.dpai || r.dfac,
        modePaiementId: r.modePaiementId || header.modePaiementId,
        designation: r.designation || r.num,
      }));
      const xml = generateXml(header, prepared);
      await saveTextFile(
        `DeclarationReleveDeduction_${header.idf}_${header.annee}_P${header.periode}.xml`,
        xml,
        [{ name: "XML", extensions: ["xml"] }],
      );
    }
    flash("ok", t("toast.xmlGenerated"));
    setOpenMenu(null);
  }

  async function exportZip() {
    try {
      if (mode === "non_residents") {
        const errors = validateNonResidentXml(header, nrRows);
        if (errors.length) {
          flash("err", translateValidation(t, errors[0]));
          setOpenMenu(null);
          return;
        }
        const base = `DeclarationNonResidents_${header.idf}_${header.annee}_P${header.periode}`;
        const xml = generateNonResidentXml(header, nrRows);
        const zip = await buildZipBlob([
          { name: `${base}.xml`, data: xml },
          {
            name: `non_residents_${header.annee}_P${header.periode}.csv`,
            data: buildNonResidentCsv(nrRows),
          },
          {
            name: `non_residents_${header.annee}_P${header.periode}.xlsx`,
            data: buildNonResidentExcelBlob(nrRows),
          },
        ]);
        await saveBinaryFile(`${base}.zip`, zip, [
          { name: "ZIP", extensions: ["zip"] },
        ]);
      } else {
        const errors = validateForXml(header, rows);
        if (errors.length) {
          flash("err", translateValidation(t, errors[0]));
          setOpenMenu(null);
          return;
        }
        const prepared = rows.map((r) => ({
          ...r,
          dpai: r.dpai || r.dfac,
          modePaiementId: r.modePaiementId || header.modePaiementId,
          designation: r.designation || r.num,
        }));
        const base = `DeclarationReleveDeduction_${header.idf}_${header.annee}_P${header.periode}`;
        const xml = generateXml(header, prepared);
        const zip = await buildZipBlob([
          { name: `${base}.xml`, data: xml },
          {
            name: `releve_deductions_${header.annee}_P${header.periode}.csv`,
            data: buildCsv(rows, false),
          },
          {
            name: `releve_deductions_${header.annee}_P${header.periode}.xlsx`,
            data: buildExcelBlob(rows, false),
          },
        ]);
        await saveBinaryFile(`${base}.zip`, zip, [
          { name: "ZIP", extensions: ["zip"] },
        ]);
      }
      flash("ok", t("toast.exportZipDone"));
    } catch (e) {
      flash("err", e instanceof Error ? e.message : t("toast.exportZipFailed"));
    } finally {
      setOpenMenu(null);
    }
  }

  function saveDraftNow() {
    const savedAt = writeAutosave({
      mode,
      header,
      rows,
      nrRows,
      showAdvanced,
    });
    setLastSavedAt(savedAt);
    setDraftRestored(false);
    flash("ok", t("toast.draftSaved"));
    setOpenMenu(null);
  }

  function resetCurrent() {
    clearAutosave();
    setHeader(headerFromCompanyProfile(companyProfile, createDefaultHeader()));
    setRows([createEmptyRow(1)]);
    setNrRows([createEmptyNonResidentRow(1)]);
    setSelected(new Set());
    setOpenMenu(null);
    setLastSavedAt(null);
    setDraftRestored(false);
    flash("info", t("toast.newDeclaration"));
  }

  function openConfig() {
    setDraftProfile(companyProfile);
    setShowConfig(true);
    setOpenMenu(null);
  }

  function saveConfig() {
    const saved = saveCompanyProfile(draftProfile);
    setCompanyProfile(saved);
    setShowConfig(false);
    if (!header.idf.trim() && saved.idf) {
      setHeader((h) => ({ ...h, idf: saved.idf }));
    }
    flash("ok", t("toast.companySaved"));
  }

  function changeLanguage(next: Locale) {
    setLocale(next);
    flash("ok", createTranslator(next)("toast.languageSaved"));
    setOpenMenu(null);
  }

  function applyCompanyIf() {
    if (!companyProfile.idf.trim()) {
      flash("info", t("toast.configureIfFirst"));
      return;
    }
    setHeader((h) => ({ ...h, idf: companyProfile.idf }));
    flash("ok", t("toast.ifApplied"));
  }

  const lineCount = mode === "releve" ? rows.length : nrRows.length;
  const saveLabel = draftRestored
    ? t("status.draftRestored")
    : lastSavedAt
      ? t("status.savedAt", { time: formatClock(locale, lastSavedAt) })
      : t("status.autosaveOn");
  const linesLabel =
    lineCount > 1
      ? t("status.lines_plural", { count: lineCount })
      : t("status.lines", { count: lineCount });

  return (
    <div className="app" onClick={() => setOpenMenu(null)}>
      {status && (
        <div className={`toast-stack toast-${status.type}`} role="status">
          {status.text}
        </div>
      )}

      {pendingDelete && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-modal-title">
              {pendingDelete.ids.length > 1
                ? t("modal.deleteTitleMultiple")
                : t("modal.deleteTitle")}
            </h2>
            <p>
              {pendingDelete.ids.length > 1
                ? t("modal.deleteBodyMultiple", {
                    count: pendingDelete.ids.length,
                  })
                : t("modal.deleteBody", { label: pendingDelete.label })}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel"
                onClick={() => setPendingDelete(null)}
              >
                {t("action.cancel")}
              </button>
              <button
                type="button"
                className="modal-confirm"
                onClick={confirmDeleteRow}
              >
                {t("action.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfig && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowConfig(false)}
        >
          <div
            className="modal modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="config-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="config-modal-title">{t("modal.configTitle")}</h2>
            <p className="modal-lead">{t("modal.configLead")}</p>
            <div className="config-form">
              <label>
                {t("modal.companyIf")}
                <input
                  value={draftProfile.idf}
                  onChange={(e) =>
                    setDraftProfile((p) => ({ ...p, idf: e.target.value }))
                  }
                  placeholder={t("placeholder.idf")}
                />
              </label>
              <label>
                {t("modal.companyName")}
                <input
                  value={draftProfile.raisonSociale}
                  onChange={(e) =>
                    setDraftProfile((p) => ({
                      ...p,
                      raisonSociale: e.target.value,
                    }))
                  }
                  placeholder={t("placeholder.companyName")}
                />
              </label>
              <label>
                {t("modal.companyAddress")}
                <textarea
                  rows={3}
                  value={draftProfile.adresse}
                  onChange={(e) =>
                    setDraftProfile((p) => ({ ...p, adresse: e.target.value }))
                  }
                  placeholder={t("placeholder.companyAddress")}
                />
              </label>
              <fieldset className="language-fieldset">
                <legend>{t("modal.languageTitle")}</legend>
                <p className="modal-lead compact">{t("modal.languageLead")}</p>
                <div className="language-options">
                  {LOCALES.map((code) => (
                    <label key={code} className="language-option">
                      <input
                        type="radio"
                        name="app-language"
                        checked={locale === code}
                        onChange={() => changeLanguage(code)}
                      />
                      <span>{t(`lang.${code}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel"
                onClick={() => {
                  setDraftProfile(DEFAULT_COMPANY_PROFILE);
                }}
              >
                {t("action.clear")}
              </button>
              <button
                type="button"
                className="modal-cancel"
                onClick={() => setShowConfig(false)}
              >
                {t("action.cancel")}
              </button>
              <button
                type="button"
                className="modal-save"
                onClick={saveConfig}
              >
                {t("action.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="topbar" onClick={(e) => e.stopPropagation()}>
        <div className="brand">
          <span className="brand-mark">EDI</span>
          <div>
            <strong>{t("app.brand")}</strong>
            <small>
              {mode === "releve"
                ? t("app.subtitle.releve")
                : t("app.subtitle.nonResidents")}
            </small>
          </div>
        </div>

        <nav className="menubar">
          <div className="menu">
            <button
              type="button"
              className={openMenu === "fichier" ? "active" : ""}
              onClick={() =>
                setOpenMenu((m) => (m === "fichier" ? null : "fichier"))
              }
            >
              {t("menu.file")}
            </button>
            {openMenu === "fichier" && (
              <div className="dropdown dropdown-wide">
                <button type="button" onClick={() => fileRef.current?.click()}>
                  {t("menu.import")}
                </button>
                <button type="button" onClick={saveDraftNow}>
                  {t("menu.saveDraft")}
                </button>
                <button type="button" onClick={resetCurrent}>
                  {t("menu.newDeclaration")}
                </button>
                {recentFiles.length > 0 && (
                  <>
                    <div className="dropdown-sep">{t("menu.recent")}</div>
                    {recentFiles.map((entry) => {
                      const label = formatRecentLabel(entry);
                      const meta = label.includes(" · ")
                        ? label.split(" · ").slice(1).join(" · ")
                        : entry.kind.toUpperCase();
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className="recent-file-item"
                          title={entry.name}
                          onClick={() => void reopenRecent(entry)}
                        >
                          <span className="recent-file-name">{entry.name}</span>
                          <span className="recent-file-meta">{meta}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="menu">
            <button
              type="button"
              className={openMenu === "modele" ? "active" : ""}
              onClick={() =>
                setOpenMenu((m) => (m === "modele" ? null : "modele"))
              }
            >
              {t("menu.template")}
            </button>
            {openMenu === "modele" && (
              <div className="dropdown">
                <button type="button" onClick={() => downloadTemplate("csv")}>
                  {t("menu.templateCsv")}
                </button>
                <button type="button" onClick={() => downloadTemplate("xlsx")}>
                  {t("menu.templateXlsx")}
                </button>
              </div>
            )}
          </div>

          <div className="menu">
            <button
              type="button"
              className={openMenu === "export" ? "active" : ""}
              onClick={() =>
                setOpenMenu((m) => (m === "export" ? null : "export"))
              }
            >
              {t("menu.export")}
            </button>
            {openMenu === "export" && (
              <div className="dropdown">
                <button type="button" onClick={exportCsv}>
                  {t("menu.exportCsv")}
                </button>
                <button type="button" onClick={exportExcel}>
                  {t("menu.exportExcel")}
                </button>
                <button type="button" onClick={exportXml}>
                  {t("menu.exportXml")}
                </button>
                <button type="button" onClick={() => void exportZip()}>
                  {t("menu.exportZip")}
                </button>
              </div>
            )}
          </div>

          <div className="menu">
            <button
              type="button"
              className={openMenu === "config" || showConfig ? "active" : ""}
              onClick={() =>
                setOpenMenu((m) => (m === "config" ? null : "config"))
              }
            >
              {t("menu.config")}
            </button>
            {openMenu === "config" && (
              <div className="dropdown">
                <button type="button" onClick={openConfig}>
                  {t("menu.configCompany")}
                </button>
                <button type="button" onClick={applyCompanyIf}>
                  {t("menu.applyIf")}
                </button>
                <div className="dropdown-sep">{t("menu.language")}</div>
                {LOCALES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={locale === code ? "menu-selected" : ""}
                    onClick={() => changeLanguage(code)}
                  >
                    {t(`lang.${code}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="top-actions">
          {selected.size > 1 && (
            <button
              type="button"
              className="danger delete-selected-btn"
              onClick={askDeleteSelected}
              title={t("action.deleteSelected", { count: selected.size })}
            >
              {t("action.deleteSelected", { count: selected.size })}
            </button>
          )}
          <button
            type="button"
            className="ghost save-btn"
            onClick={saveDraftNow}
            title={t("action.save")}
            aria-label={t("action.save")}
          >
            <svg
              className="btn-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"
              />
            </svg>
          </button>
          <button type="button" className="primary" onClick={exportXml}>
            {t("action.generateXml")}
          </button>
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,.xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFile(f);
        }}
      />

      <section className="mode-tabs" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={mode === "non_residents" ? "active" : ""}
          onClick={() => switchMode("non_residents")}
        >
          {t("mode.nonResidents")}
        </button>
        <button
          type="button"
          className={mode === "releve" ? "active" : ""}
          onClick={() => switchMode("releve")}
        >
          {t("mode.releve")}
        </button>
      </section>

      {mode === "non_residents" && (
        <p className="mode-caption">{t("mode.caption.nonResidents")}</p>
      )}

      <section className="header-panel">
        {hasCompanyProfile(companyProfile) && (
          <div className="company-chip">
            <strong>
              {companyProfile.raisonSociale || t("field.companyConfigured")}
            </strong>
            <span>
              {t("field.configIf")}: {companyProfile.idf || "—"}
              {companyProfile.adresse ? ` · ${companyProfile.adresse}` : ""}
            </span>
            <button type="button" className="chip-link" onClick={openConfig}>
              {t("action.edit")}
            </button>
          </div>
        )}
        <label>
          {t("field.idf")}
          <input
            value={header.idf}
            onChange={(e) => updateHeader("idf", e.target.value)}
            placeholder={
              companyProfile.idf
                ? t("placeholder.idfConfigured", { idf: companyProfile.idf })
                : t("placeholder.idf")
            }
          />
        </label>
        <label>
          {t("field.year")}
          <input
            value={header.annee}
            onChange={(e) => updateHeader("annee", e.target.value)}
            placeholder={t("placeholder.year")}
          />
        </label>
        <label>
          {t("field.period")}
          <input
            value={header.periode}
            onChange={(e) => updateHeader("periode", e.target.value)}
            placeholder={t("placeholder.period")}
          />
        </label>
        <label>
          {t("field.regime")}
          <select
            value={header.regime}
            onChange={(e) => {
              const regime = e.target.value;
              const { annee, periode } = defaultPeriodForRegime(regime);
              setHeader((h) => ({
                ...h,
                regime,
                annee,
                periode,
              }));
            }}
          >
            <option value="1">{t("field.regime.monthly")}</option>
            <option value="2">{t("field.regime.quarterly")}</option>
          </select>
        </label>
        {mode === "releve" && (
          <>
            <label>
              {t("field.paymentMode")}
              <input
                value={header.modePaiementId}
                onChange={(e) => updateHeader("modePaiementId", e.target.value)}
                placeholder={t("placeholder.paymentMode")}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(e) => setShowAdvanced(e.target.checked)}
              />
              {t("field.showAdvanced")}
            </label>
          </>
        )}
      </section>

      <section className="table-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="table-scroll">
        {mode === "releve" ? (
          <table>
            <thead>
              <tr>
                <th className="check-col">
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>{t("col.order")}</th>
                <th>{t("col.invoice")}</th>
                <th>{t("col.invoiceDate")}</th>
                {showAdvanced && <th>{t("col.paymentDate")}</th>}
                <th>{t("col.supplier")}</th>
                <th>{t("col.supplierIf")}</th>
                <th>{t("col.ice")}</th>
                <th>{t("col.designation")}</th>
                <th>{t("col.ht")}</th>
                <th>{t("col.vatRate")}</th>
                <th>{t("col.vat")}</th>
                <th>{t("col.ttc")}</th>
                {showAdvanced && <th>{t("col.paymentMode")}</th>}
                <th className="actions-col">{t("col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={selected.has(row.id) ? "selected" : ""}
                >
                  <td className="check-col">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                    />
                  </td>
                  <td>
                    <input
                      className="narrow"
                      value={row.ordre}
                      onChange={(e) =>
                        updateCell(row.id, "ordre", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.num}
                      onChange={(e) => updateCell(row.id, "num", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={row.dfac}
                      onChange={(e) =>
                        updateCell(row.id, "dfac", e.target.value)
                      }
                    />
                  </td>
                  {showAdvanced && (
                    <td>
                      <input
                        type="date"
                        value={row.dpai}
                        onChange={(e) =>
                          updateCell(row.id, "dpai", e.target.value)
                        }
                      />
                    </td>
                  )}
                  <td>
                    <input
                      value={row.nom}
                      onChange={(e) => updateCell(row.id, "nom", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      value={row.ifFournisseur}
                      onChange={(e) =>
                        updateCell(row.id, "ifFournisseur", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.ice}
                      onChange={(e) => updateCell(row.id, "ice", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      value={row.designation}
                      onChange={(e) =>
                        updateCell(row.id, "designation", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="num"
                      inputMode="decimal"
                      value={row.mht}
                      onChange={(e) => updateCell(row.id, "mht", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="num"
                      inputMode="decimal"
                      value={row.tx}
                      onChange={(e) => updateCell(row.id, "tx", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="num"
                      inputMode="decimal"
                      value={row.tva}
                      onChange={(e) => updateCell(row.id, "tva", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="num"
                      inputMode="decimal"
                      value={row.ttc}
                      onChange={(e) => updateCell(row.id, "ttc", e.target.value)}
                    />
                  </td>
                  {showAdvanced && (
                    <td>
                      <input
                        className="narrow"
                        value={row.modePaiementId}
                        onChange={(e) =>
                          updateCell(row.id, "modePaiementId", e.target.value)
                        }
                      />
                    </td>
                  )}
                  <td className="actions-col">
                    <button
                      type="button"
                      className="row-delete-btn"
                      title={t("action.deleteRow")}
                      onClick={() =>
                        askDeleteRow(
                          row.id,
                          row.num ||
                            row.nom ||
                            t("row.fallback", { n: row.ordre }),
                        )
                      }
                    >
                      {t("action.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={showAdvanced ? 8 : 7} />
                <td className="total-label">{t("table.total")}</td>
                <td className="total">{totals.mht.toFixed(2)}</td>
                <td />
                <td className="total">{totals.tva.toFixed(2)}</td>
                <td className="total">{totals.ttc.toFixed(2)}</td>
                {showAdvanced && <td />}
                <td />
              </tr>
            </tfoot>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="check-col">
                  <input
                    type="checkbox"
                    checked={selected.size === nrRows.length && nrRows.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>{t("col.name")}</th>
                <th>{t("col.foreignAddress")}</th>
                <th>{t("col.taxId")}</th>
                <th>{t("col.operationNature")}</th>
                <th>{t("col.paymentDateFull")}</th>
                <th>{t("col.taxableBase")}</th>
                <th>{t("col.rate")}</th>
                <th>{t("col.vatDue")}</th>
                <th className="actions-col">{t("col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {nrRows.map((row) => (
                <tr
                  key={row.id}
                  className={selected.has(row.id) ? "selected" : ""}
                >
                  <td className="check-col">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                    />
                  </td>
                  <td>
                    <input
                      value={row.nom}
                      onChange={(e) =>
                        updateNrCell(row.id, "nom", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.adresse}
                      onChange={(e) =>
                        updateNrCell(row.id, "adresse", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.identifiantFiscal}
                      onChange={(e) =>
                        updateNrCell(row.id, "identifiantFiscal", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.natureOperation}
                      onChange={(e) =>
                        updateNrCell(row.id, "natureOperation", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={row.datePaiement}
                      onChange={(e) =>
                        updateNrCell(row.id, "datePaiement", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="num"
                      inputMode="decimal"
                      value={row.baseImposable}
                      onChange={(e) =>
                        updateNrCell(row.id, "baseImposable", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="num"
                      inputMode="decimal"
                      value={row.taux}
                      onChange={(e) =>
                        updateNrCell(row.id, "taux", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="num"
                      inputMode="decimal"
                      value={row.tvaExigible}
                      onChange={(e) =>
                        updateNrCell(row.id, "tvaExigible", e.target.value)
                      }
                    />
                  </td>
                  <td className="actions-col">
                    <button
                      type="button"
                      className="row-delete-btn"
                      title={t("action.deleteRow")}
                      onClick={() =>
                        askDeleteRow(
                          row.id,
                          row.nom || t("row.fallback", { n: row.ordre }),
                        )
                      }
                    >
                      {t("action.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} />
                <td className="total-label">{t("table.totalShort")}</td>
                <td className="total">{nrTotals.base.toFixed(2)}</td>
                <td />
                <td className="total highlight">{nrTotals.tva.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
        </div>

        <div className="table-actions">
          <button
            type="button"
            className="add-row-btn"
            onMouseDown={(e) => {
              // Keep the click from being lost when leaving a focused table input.
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              addRow();
            }}
          >
            {t("action.addRow")}
          </button>
        </div>
      </section>

      <footer className="statusbar">
        <span>{linesLabel}</span>
        <span className="autosave-label">{saveLabel}</span>
        <span className="hint">
          {mode === "releve"
            ? t("status.hint.releve")
            : t("status.hint.nonResidents")}
        </span>
      </footer>
    </div>
  );
}
