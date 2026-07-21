import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toNumber } from "./amounts";
import {
  TEMPLATE_HEADERS,
  TABLE_HEADERS,
  createEmptyRow,
  type DeductionRow,
} from "../types";

const HEADER_ALIASES: Record<string, keyof MappedRow> = {
  "n ordre": "ordre",
  "no ordre": "ordre",
  ordre: "ordre",
  "n facture": "num",
  "no facture": "num",
  facture: "num",
  "date facture": "dfac",
  dfac: "dfac",
  "date paiement": "dpai",
  dpai: "dpai",
  fournisseur: "nom",
  nom: "nom",
  "if fournisseur": "ifFournisseur",
  if: "ifFournisseur",
  ice: "ice",
  designation: "designation",
  "montant ht": "mht",
  mht: "mht",
  "taux tva (%)": "tx",
  "taux tva": "tx",
  tx: "tx",
  "montant tva": "tva",
  tva: "tva",
  "montant ttc": "ttc",
  ttc: "ttc",
  "mode paiement": "modePaiementId",
  mp: "modePaiementId",
};

type MappedRow = {
  ordre?: string;
  num?: string;
  dfac?: string;
  dpai?: string;
  nom?: string;
  ifFournisseur?: string;
  ice?: string;
  designation?: string;
  mht?: string;
  tx?: string;
  tva?: string;
  ttc?: string;
  modePaiementId?: string;
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapHeaders(headers: string[]): (keyof MappedRow | null)[] {
  return headers.map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? null);
}

function rowsFromMatrix(matrix: string[][]): DeductionRow[] {
  if (matrix.length < 2) return [];
  const headers = matrix[0];
  const mapped = mapHeaders(headers);
  const dataRows = matrix.slice(1).filter((r) => r.some((c) => String(c ?? "").trim()));

  return dataRows.map((cells, index) => {
    const obj: MappedRow = {};
    mapped.forEach((field, col) => {
      if (!field) return;
      obj[field] = String(cells[col] ?? "").trim();
    });

    const mht = obj.mht === undefined || obj.mht === "" ? "" : toNumber(obj.mht);
    const tx = obj.tx === undefined || obj.tx === "" ? "" : toNumber(obj.tx);
    const tva = obj.tva === undefined || obj.tva === "" ? "" : toNumber(obj.tva);
    const ttc = obj.ttc === undefined || obj.ttc === "" ? "" : toNumber(obj.ttc);

    return {
      id: crypto.randomUUID(),
      ordre: obj.ordre ? Number(obj.ordre) || index + 1 : index + 1,
      num: obj.num ?? "",
      dfac: obj.dfac ?? "",
      dpai: obj.dpai ?? "",
      nom: obj.nom ?? "",
      ifFournisseur: obj.ifFournisseur ?? "",
      ice: obj.ice ?? "",
      designation: obj.designation ?? "",
      mht,
      tx,
      tva,
      ttc,
      modePaiementId: obj.modePaiementId ?? "7",
    };
  });
}

export function parseCsv(content: string): DeductionRow[] {
  const parsed = Papa.parse<string[]>(content, {
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "Erreur CSV");
  }
  return rowsFromMatrix(parsed.data as string[][]);
}

export function parseExcel(buffer: ArrayBuffer): DeductionRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  return rowsFromMatrix(matrix.map((row) => row.map((c) => String(c ?? ""))));
}

export function rowsToAoA(rows: DeductionRow[], includeExtras = false): (string | number)[][] {
  const headers = includeExtras ? [...TEMPLATE_HEADERS] : [...TABLE_HEADERS];
  const data = rows.map((r) => {
    const base: (string | number)[] = [
      r.ordre,
      r.num,
      r.dfac,
      r.nom,
      r.ifFournisseur,
      r.ice,
      r.designation,
      r.mht === "" ? "" : r.mht,
      r.tx === "" ? "" : r.tx,
      r.tva === "" ? "" : r.tva,
      r.ttc === "" ? "" : r.ttc,
    ];
    if (includeExtras) {
      base.push(r.dpai, r.modePaiementId);
    }
    return base;
  });
  return [headers, ...data];
}

export function buildCsv(rows: DeductionRow[], includeExtras = false): string {
  return Papa.unparse(rowsToAoA(rows, includeExtras));
}

export function buildExcelBlob(rows: DeductionRow[], includeExtras = false): Blob {
  const aoa = rowsToAoA(rows, includeExtras);
  const totalMht = rows.reduce((s, r) => s + toNumber(r.mht), 0);
  const totalTva = rows.reduce((s, r) => s + toNumber(r.tva), 0);
  const totalTtc = rows.reduce((s, r) => s + toNumber(r.ttc), 0);
  if (rows.length > 0) {
    aoa.push(["", "", "", "", "", "", "TOTAL", totalMht, "", totalTva, totalTtc]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relevé des déductions");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function buildTemplateRows(): DeductionRow[] {
  const sample = createEmptyRow(1, "7");
  sample.num = "FAC-2025-001";
  sample.dfac = "2025-10-15";
  sample.dpai = "2025-10-31";
  sample.nom = "Exemple Fournisseur SARL";
  sample.ifFournisseur = "12345678";
  sample.ice = "002000000000000";
  sample.designation = "Services";
  sample.mht = 1000;
  sample.tx = 20;
  sample.tva = 200;
  sample.ttc = 1200;
  return [sample];
}
