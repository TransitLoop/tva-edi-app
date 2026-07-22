import Papa from "papaparse";
import * as XLSX from "xlsx";
import { formatXmlNumber, normalizeDate, round2, toNumber } from "./amounts";
import {
  NON_RESIDENT_HEADERS,
  createEmptyNonResidentRow,
  type DeclarationHeader,
  type NonResidentRow,
} from "../types";

type MappedNr = {
  nom?: string;
  adresse?: string;
  identifiantFiscal?: string;
  natureOperation?: string;
  datePaiement?: string;
  baseImposable?: string;
  taux?: string;
  tvaExigible?: string;
};

const NR_ALIASES: Record<string, keyof MappedNr> = {
  "nom et prenom ou raison sociale": "nom",
  "nom prenom ou raison sociale": "nom",
  "raison sociale": "nom",
  nom: "nom",
  "adresse a l'etranger": "adresse",
  "adresse a letranger": "adresse",
  "adresse etranger": "adresse",
  adresse: "adresse",
  "n d'identification fiscale": "identifiantFiscal",
  "n identification fiscale": "identifiantFiscal",
  "numero d'identification fiscale": "identifiantFiscal",
  "identifiant fiscal": "identifiantFiscal",
  "n d'identifiant": "identifiantFiscal",
  "n identifiant": "identifiantFiscal",
  nif: "identifiantFiscal",
  "nature de l'operation": "natureOperation",
  "nature de l operation": "natureOperation",
  "nature operation": "natureOperation",
  nature: "natureOperation",
  "date de paiement": "datePaiement",
  "date paiement": "datePaiement",
  "base imposable (ht)": "baseImposable",
  "base imposable ht": "baseImposable",
  "base imposable": "baseImposable",
  "taux (%)": "taux",
  taux: "taux",
  "tva exigible": "tvaExigible",
  tva: "tvaExigible",
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function text(value: string | number): string {
  return escapeXml(String(value ?? "").trim());
}

function rowsFromMatrix(matrix: string[][]): NonResidentRow[] {
  if (matrix.length < 2) return [];
  const mapped = matrix[0].map((h) => NR_ALIASES[normalizeHeader(h)] ?? null);
  const dataRows = matrix
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim()));

  return dataRows.map((cells, index) => {
    const obj: MappedNr = {};
    mapped.forEach((field, col) => {
      if (!field) return;
      obj[field] = String(cells[col] ?? "").trim();
    });

    const base: number | "" =
      obj.baseImposable === undefined || obj.baseImposable === ""
        ? ""
        : toNumber(obj.baseImposable);
    const taux: number | "" =
      obj.taux === undefined || obj.taux === "" ? "" : toNumber(obj.taux);
    let tva: number | "" =
      obj.tvaExigible === undefined || obj.tvaExigible === ""
        ? ""
        : toNumber(obj.tvaExigible);
    if (tva === "" && base !== "" && taux !== "") {
      tva = round2((base * taux) / 100);
    }

    return {
      id: crypto.randomUUID(),
      ordre: index + 1,
      nom: obj.nom ?? "",
      adresse: obj.adresse ?? "",
      identifiantFiscal: obj.identifiantFiscal ?? "",
      natureOperation: obj.natureOperation ?? "",
      datePaiement: obj.datePaiement ?? "",
      baseImposable: base,
      taux,
      tvaExigible: tva,
    };
  });
}

export function parseNonResidentCsv(content: string): NonResidentRow[] {
  const parsed = Papa.parse<string[]>(content, { skipEmptyLines: true });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "Erreur CSV");
  }
  return rowsFromMatrix(parsed.data as string[][]);
}

export function parseNonResidentExcel(buffer: ArrayBuffer): NonResidentRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  return rowsFromMatrix(matrix.map((row) => row.map((c) => String(c ?? ""))));
}

function rowsToAoA(rows: NonResidentRow[]): (string | number)[][] {
  return [
    [...NON_RESIDENT_HEADERS],
    ...rows.map((r) => [
      r.nom,
      r.adresse,
      r.identifiantFiscal,
      r.natureOperation,
      r.datePaiement,
      r.baseImposable === "" ? "" : r.baseImposable,
      r.taux === "" ? "" : r.taux,
      r.tvaExigible === "" ? "" : r.tvaExigible,
    ]),
  ];
}

export function buildNonResidentCsv(rows: NonResidentRow[]): string {
  return Papa.unparse(rowsToAoA(rows));
}

export function buildNonResidentExcelBlob(rows: NonResidentRow[]): Blob {
  const aoa = rowsToAoA(rows);
  const totalBase = rows.reduce((s, r) => s + toNumber(r.baseImposable), 0);
  const totalTva = rows.reduce((s, r) => s + toNumber(r.tvaExigible), 0);
  if (rows.length > 0) {
    aoa.push(["", "", "", "", "TOTAL", totalBase, "", totalTva]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Non-résidents");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function buildNonResidentTemplateRows(): NonResidentRow[] {
  const sample = createEmptyNonResidentRow(1);
  sample.nom = "Exemple Vendor Inc";
  sample.adresse = "624 University Ave Palo Alto California 94301";
  sample.identifiantFiscal = "2222";
  sample.natureOperation = "Services";
  sample.datePaiement = "2026-01-08";
  sample.baseImposable = 1000;
  sample.taux = 20;
  sample.tvaExigible = 200;
  return [sample];
}

/**
 * XML for liste des contribuables non résidents.
 * Structure mirrors Simpl-TVA header conventions + row fields from the official form.
 * Adjust tag names if DGI publishes a dedicated XSD annex.
 */
export function generateNonResidentXml(
  header: DeclarationHeader,
  rows: NonResidentRow[],
): string {
  const body = rows
    .map((row, index) => {
      const ordre = row.ordre || index + 1;
      const base = toNumber(row.baseImposable);
      const taux = toNumber(row.taux);
      const tva = toNumber(row.tvaExigible);
      const datePaiement = normalizeDate(row.datePaiement);

      return `                <cnr>
                    <ordre>${ordre}</ordre>
                    <nom>${text(row.nom)}</nom>
                    <adresse>${text(row.adresse)}</adresse>
                    <idfNR>${text(row.identifiantFiscal)}</idfNR>
                    <natureOperation>${text(row.natureOperation)}</natureOperation>
                    <datePaiement>${text(datePaiement)}</datePaiement>
                    <baseImposable>${formatXmlNumber(base)}</baseImposable>
                    <taux>${formatXmlNumber(taux)}</taux>
                    <tvaExigible>${formatXmlNumber(tva)}</tvaExigible>
                </cnr>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
        <DeclarationNonResidents>
            <idf>${text(header.idf)}</idf>
            <annee>${text(header.annee)}</annee>
            <periode>${text(header.periode)}</periode>
            <regime>${text(header.regime)}</regime>
            <contribuablesNonResidents>
${body}
            </contribuablesNonResidents>
        </DeclarationNonResidents>
`;
}

export function parseNonResidentXml(xmlContent: string): {
  header: DeclarationHeader;
  rows: NonResidentRow[];
} {
  const doc = new DOMParser().parseFromString(xmlContent, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Fichier XML invalide.");
  }

  const root =
    doc.querySelector("DeclarationNonResidents") ?? doc.documentElement;

  const header: DeclarationHeader = {
    idf: root.querySelector("idf")?.textContent?.trim() ?? "",
    annee: root.querySelector("annee")?.textContent?.trim() ?? "",
    periode: root.querySelector("periode")?.textContent?.trim() ?? "",
    regime: root.querySelector("regime")?.textContent?.trim() ?? "2",
    modePaiementId: "7",
  };

  const rows: NonResidentRow[] = Array.from(
    root.querySelectorAll("contribuablesNonResidents > cnr, cnr"),
  ).map((node, index) => {
    const base = Number(node.querySelector("baseImposable")?.textContent ?? 0);
    const taux = Number(node.querySelector("taux")?.textContent ?? 0);
    const tva = Number(node.querySelector("tvaExigible")?.textContent ?? 0);
    return {
      id: crypto.randomUUID(),
      ordre: Number(node.querySelector("ordre")?.textContent ?? index + 1),
      nom: node.querySelector("nom")?.textContent?.trim() ?? "",
      adresse: node.querySelector("adresse")?.textContent?.trim() ?? "",
      identifiantFiscal:
        node.querySelector("idfNR")?.textContent?.trim() ??
        node.querySelector("identifiantFiscal")?.textContent?.trim() ??
        "",
      natureOperation:
        node.querySelector("natureOperation")?.textContent?.trim() ?? "",
      datePaiement:
        node.querySelector("datePaiement")?.textContent?.trim() ?? "",
      baseImposable: base,
      taux,
      tvaExigible: tva,
    };
  });

  return { header, rows };
}

export function validateNonResidentXml(
  header: DeclarationHeader,
  rows: NonResidentRow[],
): string[] {
  const errors: string[] = [];
  if (!header.idf.trim()) errors.push("validation.idfRequired");
  if (!header.annee.trim()) errors.push("validation.yearRequired");
  if (!header.periode.trim()) errors.push("validation.periodRequired");
  if (!header.regime.trim()) errors.push("validation.regimeRequired");
  if (rows.length === 0) errors.push("validation.rowsRequiredNr");

  rows.forEach((row, i) => {
    const n = i + 1;
    if (!row.nom.trim()) errors.push(`validation.nameRequired|${n}`);
    if (!row.adresse.trim()) errors.push(`validation.addressRequired|${n}`);
    if (!normalizeDate(row.datePaiement)) {
      errors.push(`validation.paymentDateRequired|${n}`);
    }
    if (row.baseImposable === "" || toNumber(row.baseImposable) < 0) {
      errors.push(`validation.baseInvalid|${n}`);
    }
  });

  return errors;
}

export function isNonResidentXml(xmlContent: string): boolean {
  return /DeclarationNonResidents|<cnr>|<contribuablesNonResidents>/i.test(
    xmlContent,
  );
}
