import { formatXmlNumber, normalizeDate, toNumber } from "./amounts";
import type { DeclarationHeader, DeductionRow } from "../types";

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

/**
 * Generate DeclarationReleveDeduction XML for Simpl-TVA / DGI EDI upload.
 * Structure mirrors the working sample files and the reverse of xml_to_table.py.
 *
 * Note: the attached Cahier des charges PDF (9370) documents Simpl-IS (IS).
 * Relevé des déductions TVA uses the DeclarationReleveDeduction schema shown
 * in the sample XML files of this project.
 */
export function generateXml(
  header: DeclarationHeader,
  rows: DeductionRow[],
): string {
  const body = rows
    .map((row, index) => {
      const ordre = row.ordre || index + 1;
      const mht = toNumber(row.mht);
      const tx = toNumber(row.tx);
      const tva = toNumber(row.tva);
      const ttc = toNumber(row.ttc);
      const dfac = normalizeDate(row.dfac);
      const dpai = normalizeDate(row.dpai || row.dfac);
      const designation = row.designation.trim() || row.num.trim();
      const mp = row.modePaiementId.trim() || header.modePaiementId || "7";

      return `                <rd>
                    <ordre>${ordre}</ordre>
                    <num>${text(row.num)}</num>
                    <des>${text(designation)}</des>
                    <mht>${formatXmlNumber(mht)}</mht>
                    <tva>${formatXmlNumber(tva)}</tva>
                    <ttc>${formatXmlNumber(ttc)}</ttc>
                    <refF>
                        <if>${text(row.ifFournisseur)}</if>
                        <nom>${text(row.nom)}</nom>
                        <ice>${text(row.ice)}</ice>
                    </refF>
                    <tx>${formatXmlNumber(tx)}</tx>
                    <mp>
                        <id>${text(mp)}</id>
                    </mp>
                    <dpai>${text(dpai)}</dpai>
                    <dfac>${text(dfac)}</dfac>
                </rd>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
        <DeclarationReleveDeduction>
            <idf>${text(header.idf)}</idf>
            <annee>${text(header.annee)}</annee>
            <periode>${text(header.periode)}</periode>
            <regime>${text(header.regime)}</regime>
            <releveDeductions>
${body}
            </releveDeductions>
        </DeclarationReleveDeduction>
`;
}

export function parseXml(xmlContent: string): {
  header: DeclarationHeader;
  rows: DeductionRow[];
} {
  const doc = new DOMParser().parseFromString(xmlContent, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Fichier XML invalide.");
  }

  const root =
    doc.querySelector("DeclarationReleveDeduction") ?? doc.documentElement;

  const header: DeclarationHeader = {
    idf: root.querySelector("idf")?.textContent?.trim() ?? "",
    annee: root.querySelector("annee")?.textContent?.trim() ?? "",
    periode: root.querySelector("periode")?.textContent?.trim() ?? "",
    regime: root.querySelector("regime")?.textContent?.trim() ?? "2",
    modePaiementId:
      root.querySelector("rd mp id")?.textContent?.trim() ?? "7",
  };

  const rows: DeductionRow[] = Array.from(
    root.querySelectorAll("releveDeductions > rd"),
  ).map((rd, index) => {
    const mht = Number(rd.querySelector("mht")?.textContent ?? 0);
    const tx = Number(rd.querySelector("tx")?.textContent ?? 0);
    const tva = Number(rd.querySelector("tva")?.textContent ?? 0);
    const ttc = Number(rd.querySelector("ttc")?.textContent ?? 0);
    return {
      id: crypto.randomUUID(),
      ordre: Number(rd.querySelector("ordre")?.textContent ?? index + 1),
      num: rd.querySelector("num")?.textContent?.trim() ?? "",
      dfac: rd.querySelector("dfac")?.textContent?.trim() ?? "",
      dpai: rd.querySelector("dpai")?.textContent?.trim() ?? "",
      nom: rd.querySelector("refF > nom")?.textContent?.trim() ?? "",
      ifFournisseur: rd.querySelector("refF > if")?.textContent?.trim() ?? "",
      ice: rd.querySelector("refF > ice")?.textContent?.trim() ?? "",
      designation: rd.querySelector("des")?.textContent?.trim() ?? "",
      mht,
      tx,
      tva,
      ttc,
      modePaiementId: rd.querySelector("mp > id")?.textContent?.trim() ?? "7",
    };
  });

  return { header, rows };
}

export function validateForXml(
  header: DeclarationHeader,
  rows: DeductionRow[],
): string[] {
  const errors: string[] = [];
  if (!header.idf.trim()) errors.push("Identifiant fiscal (IF) requis.");
  if (!header.annee.trim()) errors.push("Année requise.");
  if (!header.periode.trim()) errors.push("Période requise.");
  if (!header.regime.trim()) errors.push("Régime requis.");
  if (rows.length === 0) errors.push("Ajoutez au moins une ligne de déduction.");

  rows.forEach((row, i) => {
    const n = i + 1;
    if (!row.num.trim()) errors.push(`Ligne ${n}: N° facture requis.`);
    if (!normalizeDate(row.dfac)) errors.push(`Ligne ${n}: Date facture requise (AAAA-MM-JJ).`);
    if (!row.nom.trim()) errors.push(`Ligne ${n}: Fournisseur requis.`);
    if (!row.ifFournisseur.trim()) errors.push(`Ligne ${n}: IF fournisseur requis.`);
    if (row.mht === "" || toNumber(row.mht) < 0) {
      errors.push(`Ligne ${n}: Montant HT invalide.`);
    }
  });

  return errors;
}
