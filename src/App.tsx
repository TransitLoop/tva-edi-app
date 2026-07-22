import { useMemo, useRef, useState } from "react";
import { computeTvaTtc, round2, toNumber } from "./lib/amounts";
import { saveBinaryFile, saveTextFile } from "./lib/download";
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
import { generateXml, parseXml, validateForXml } from "./lib/xml";
import {
  DEFAULT_HEADER,
  createEmptyNonResidentRow,
  createEmptyRow,
  type AppMode,
  type DeclarationHeader,
  type DeductionRow,
  type NonResidentRow,
} from "./types";
import "./App.css";

type MenuKey = "fichier" | "modele" | "export" | null;
type Status = { type: "ok" | "err" | "info"; text: string } | null;

export default function App() {
  const [mode, setMode] = useState<AppMode>("releve");
  const [header, setHeader] = useState<DeclarationHeader>(DEFAULT_HEADER);
  const [rows, setRows] = useState<DeductionRow[]>([createEmptyRow(1)]);
  const [nrRows, setNrRows] = useState<NonResidentRow[]>([
    createEmptyNonResidentRow(1),
  ]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [status, setStatus] = useState<Status>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  function flash(type: "ok" | "err" | "info", text: string) {
    setStatus({ type, text });
    window.setTimeout(() => setStatus(null), 4500);
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

  function deleteSelected() {
    if (selected.size === 0) {
      flash("info", "Sélectionnez une ou plusieurs lignes à supprimer.");
      return;
    }
    if (mode === "releve") {
      setRows((prev) => {
        const next = renumber(prev.filter((r) => !selected.has(r.id)));
        return next.length ? next : [createEmptyRow(1, header.modePaiementId)];
      });
    } else {
      setNrRows((prev) => {
        const next = renumberNr(prev.filter((r) => !selected.has(r.id)));
        return next.length ? next : [createEmptyNonResidentRow(1)];
      });
    }
    setSelected(new Set());
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

  async function onImportFile(file: File) {
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".xml")) {
        const text = await file.text();
        if (isNonResidentXml(text) || mode === "non_residents") {
          const parsed = parseNonResidentXml(text);
          setHeader((h) => ({ ...h, ...parsed.header }));
          setNrRows(
            parsed.rows.length ? parsed.rows : [createEmptyNonResidentRow(1)],
          );
          setMode("non_residents");
          flash("ok", `XML non-résidents importé: ${parsed.rows.length} ligne(s).`);
        } else {
          const parsed = parseXml(text);
          setHeader((h) => ({ ...h, ...parsed.header }));
          setRows(
            parsed.rows.length
              ? parsed.rows
              : [createEmptyRow(1, header.modePaiementId)],
          );
          setMode("releve");
          flash("ok", `XML relevé importé: ${parsed.rows.length} ligne(s).`);
        }
      } else if (name.endsWith(".csv")) {
        const text = await file.text();
        if (mode === "non_residents") {
          const parsed = parseNonResidentCsv(text);
          setNrRows(parsed.length ? renumberNr(parsed) : [createEmptyNonResidentRow(1)]);
          flash("ok", `CSV importé: ${parsed.length} ligne(s).`);
        } else {
          const parsed = parseCsv(text);
          setRows(parsed.length ? renumber(parsed) : [createEmptyRow(1)]);
          flash("ok", `CSV importé: ${parsed.length} ligne(s).`);
        }
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        if (mode === "non_residents") {
          const parsed = parseNonResidentExcel(buf);
          setNrRows(parsed.length ? renumberNr(parsed) : [createEmptyNonResidentRow(1)]);
          flash("ok", `Excel importé: ${parsed.length} ligne(s).`);
        } else {
          const parsed = parseExcel(buf);
          setRows(parsed.length ? renumber(parsed) : [createEmptyRow(1)]);
          flash("ok", `Excel importé: ${parsed.length} ligne(s).`);
        }
      } else {
        flash("err", "Formats acceptés: .xml, .csv, .xlsx");
      }
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Import impossible.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
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
    flash("ok", `Modèle ${format.toUpperCase()} téléchargé.`);
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
    flash("ok", "Export CSV terminé.");
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
    flash("ok", "Export Excel terminé.");
    setOpenMenu(null);
  }

  async function exportXml() {
    if (mode === "non_residents") {
      const errors = validateNonResidentXml(header, nrRows);
      if (errors.length) {
        flash("err", errors[0]);
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
        flash("err", errors[0]);
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
    flash("ok", "Fichier XML EDI généré.");
    setOpenMenu(null);
  }

  function resetCurrent() {
    setHeader(DEFAULT_HEADER);
    if (mode === "releve") {
      setRows([createEmptyRow(1)]);
    } else {
      setNrRows([createEmptyNonResidentRow(1)]);
    }
    setSelected(new Set());
    setOpenMenu(null);
    flash("info", "Nouvelle déclaration.");
  }

  const lineCount = mode === "releve" ? rows.length : nrRows.length;

  return (
    <div className="app" onClick={() => setOpenMenu(null)}>
      <header className="topbar" onClick={(e) => e.stopPropagation()}>
        <div className="brand">
          <span className="brand-mark">DGI</span>
          <div>
            <strong>TVA EDI</strong>
            <small>
              {mode === "releve"
                ? "Relevé des déductions — Simpl-TVA"
                : "Contribuables non résidents — Simpl-TVA"}
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
              Fichier
            </button>
            {openMenu === "fichier" && (
              <div className="dropdown">
                <button type="button" onClick={() => fileRef.current?.click()}>
                  Importer CSV / Excel / XML…
                </button>
                <button type="button" onClick={resetCurrent}>
                  Nouvelle déclaration
                </button>
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
              Modèle
            </button>
            {openMenu === "modele" && (
              <div className="dropdown">
                <button type="button" onClick={() => downloadTemplate("csv")}>
                  Télécharger modèle CSV
                </button>
                <button type="button" onClick={() => downloadTemplate("xlsx")}>
                  Télécharger modèle Excel
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
              Exporter
            </button>
            {openMenu === "export" && (
              <div className="dropdown">
                <button type="button" onClick={exportCsv}>
                  Exporter CSV
                </button>
                <button type="button" onClick={exportExcel}>
                  Exporter Excel
                </button>
                <button type="button" onClick={exportXml}>
                  Générer XML EDI
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="top-actions">
          <button type="button" className="ghost" onClick={addRow}>
            + Ajouter
          </button>
          <button type="button" className="ghost danger" onClick={deleteSelected}>
            Supprimer
          </button>
          <button type="button" className="primary" onClick={exportXml}>
            Générer XML
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
          className={mode === "releve" ? "active" : ""}
          onClick={() => switchMode("releve")}
        >
          Relevé des déductions
        </button>
        <button
          type="button"
          className={mode === "non_residents" ? "active" : ""}
          onClick={() => switchMode("non_residents")}
        >
          Liste des contribuables non résidents EDI
        </button>
      </section>

      {mode === "non_residents" && (
        <p className="mode-caption">
          Opérations réalisées avec des contribuables non résidents à l’exclusion
          des redevances et droits de licence visés à l’article 91-XI
        </p>
      )}

      <section className="header-panel">
        <label>
          IF déclarant
          <input
            value={header.idf}
            onChange={(e) => updateHeader("idf", e.target.value)}
            placeholder="ex: 66264953"
          />
        </label>
        <label>
          Année
          <input
            value={header.annee}
            onChange={(e) => updateHeader("annee", e.target.value)}
            placeholder="2025"
          />
        </label>
        <label>
          Période
          <input
            value={header.periode}
            onChange={(e) => updateHeader("periode", e.target.value)}
            placeholder="1–4 (trim.) ou 1–12 (mens.)"
          />
        </label>
        <label>
          Régime
          <select
            value={header.regime}
            onChange={(e) => updateHeader("regime", e.target.value)}
          >
            <option value="1">1 — Mensuel</option>
            <option value="2">2 — Trimestriel</option>
          </select>
        </label>
        {mode === "releve" && (
          <>
            <label>
              Mode paiement (défaut)
              <input
                value={header.modePaiementId}
                onChange={(e) => updateHeader("modePaiementId", e.target.value)}
                placeholder="7"
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(e) => setShowAdvanced(e.target.checked)}
              />
              Afficher date paiement / mode paiement
            </label>
          </>
        )}
      </section>

      <section className="table-wrap">
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
                <th>N° ordre</th>
                <th>N° facture</th>
                <th>Date facture</th>
                {showAdvanced && <th>Date paiement</th>}
                <th>Fournisseur</th>
                <th>IF fournisseur</th>
                <th>ICE</th>
                <th>Désignation</th>
                <th>Montant HT</th>
                <th>Taux TVA (%)</th>
                <th>Montant TVA</th>
                <th>Montant TTC</th>
                {showAdvanced && <th>Mode paiement</th>}
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
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={showAdvanced ? 8 : 7} />
                <td className="total-label">TOTAL</td>
                <td className="total">{totals.mht.toFixed(2)}</td>
                <td />
                <td className="total">{totals.tva.toFixed(2)}</td>
                <td className="total">{totals.ttc.toFixed(2)}</td>
                {showAdvanced && <td />}
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
                <th>Nom et Prénom ou raison sociale</th>
                <th>Adresse à l&apos;étranger</th>
                <th>N° d&apos;identification fiscale</th>
                <th>Nature de l&apos;opération</th>
                <th>Date de paiement</th>
                <th>Base imposable (HT)</th>
                <th>Taux (%)</th>
                <th>TVA exigible</th>
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
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} />
                <td className="total-label">Total</td>
                <td className="total">{nrTotals.base.toFixed(2)}</td>
                <td />
                <td className="total highlight">{nrTotals.tva.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <footer className="statusbar">
        <span>
          {lineCount} ligne{lineCount > 1 ? "s" : ""}
        </span>
        {status && <span className={`toast ${status.type}`}>{status.text}</span>}
        <span className="hint">
          {mode === "releve"
            ? "XML: DeclarationReleveDeduction · Dates AAAA-MM-JJ · Décimal « . »"
            : "XML: DeclarationNonResidents · Dates AAAA-MM-JJ · Décimal « . »"}
        </span>
      </footer>
    </div>
  );
}
