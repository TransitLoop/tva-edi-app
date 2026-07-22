import { describe, expect, it } from "vitest";
import {
  isValidNonResidentXmlFormat,
  validateNonResidentXmlFormat,
} from "../format";
import {
  generateNonResidentXml,
  parseNonResidentCsv,
  parseNonResidentXml,
  validateNonResidentXml,
} from "../nonResidents";
import type { DeclarationHeader, NonResidentRow } from "../../types";

const header: DeclarationHeader = {
  idf: "66264953",
  annee: "2026",
  periode: "1",
  regime: "1",
  modePaiementId: "7",
};

const row: NonResidentRow = {
  id: "1",
  ordre: 1,
  nom: "Cursor",
  adresse: "801 West End Ave New York",
  identifiantFiscal: "2222",
  natureOperation: "Services",
  datePaiement: "08/01/2026",
  baseImposable: 198.18,
  taux: 20,
  tvaExigible: 39.64,
};

describe("non-résidents format", () => {
  it("rejects incomplete payload", () => {
    expect(validateNonResidentXml({ ...header, idf: "" }, [row]).length).toBeGreaterThan(
      0,
    );
    expect(
      validateNonResidentXml(header, [{ ...row, nom: "", adresse: "" }]).length,
    ).toBeGreaterThan(0);
  });

  it("accepts a complete payload", () => {
    expect(validateNonResidentXml(header, [row])).toEqual([]);
  });

  it("generates XML with required tags, ISO date, and valid format", () => {
    const xml = generateNonResidentXml(header, [row]);
    expect(xml).toContain("<DeclarationNonResidents>");
    expect(xml).toContain("<contribuablesNonResidents>");
    expect(xml).toContain("<cnr>");
    expect(xml).toContain("<datePaiement>2026-01-08</datePaiement>");
    expect(xml).toContain("<baseImposable>198.18</baseImposable>");
    expect(xml).toContain("<tvaExigible>39.64</tvaExigible>");

    expect(validateNonResidentXmlFormat(xml)).toEqual([]);
    expect(isValidNonResidentXmlFormat(xml)).toBe(true);
  });

  it("detects missing cnr rows", () => {
    const xml = `<?xml version="1.0"?>
      <DeclarationNonResidents>
        <idf>1</idf><annee>2026</annee><periode>1</periode><regime>1</regime>
        <contribuablesNonResidents></contribuablesNonResidents>
      </DeclarationNonResidents>`;
    const issues = validateNonResidentXmlFormat(xml);
    expect(issues.some((i) => i.message.includes("<cnr>"))).toBe(true);
  });

  it("round-trips generate → parse", () => {
    const xml = generateNonResidentXml(header, [row]);
    const parsed = parseNonResidentXml(xml);
    expect(parsed.header.idf).toBe(header.idf);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].nom).toBe("Cursor");
    expect(parsed.rows[0].datePaiement).toBe("2026-01-08");
    expect(parsed.rows[0].baseImposable).toBe(198.18);
  });

  it("parses CSV template headers", () => {
    const csv = [
      "Nom et Prénom ou raison sociale,Adresse à l'étranger,N° d'identification fiscale,Nature de l'opération,Date de paiement,Base imposable (HT),Taux (%),TVA exigible",
      "Netlify,2325 3rd Street,2222,Services,02/01/2026,19,20,3.8",
    ].join("\n");
    const rows = parseNonResidentCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].nom).toBe("Netlify");
    expect(rows[0].baseImposable).toBe(19);
    expect(rows[0].tvaExigible).toBe(3.8);
  });
});
