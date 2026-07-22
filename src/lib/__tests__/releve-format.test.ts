import { describe, expect, it } from "vitest";
import {
  isValidReleveXmlFormat,
  validateReleveXmlFormat,
} from "../format";
import { generateXml, parseXml, validateForXml } from "../xml";
import type { DeclarationHeader, DeductionRow } from "../../types";

const header: DeclarationHeader = {
  idf: "66264953",
  annee: "2025",
  periode: "4",
  regime: "2",
  modePaiementId: "7",
};

const row: DeductionRow = {
  id: "1",
  ordre: 1,
  num: "BILL/2025/11/0003",
  dfac: "2025-11-01",
  dpai: "2025-11-05",
  nom: "Amazon Web Services EMEA SARL",
  ifFournisseur: "20727020",
  ice: "20727020",
  designation: "Services",
  mht: 78.7,
  tx: 10,
  tva: 7.87,
  ttc: 86.57,
  modePaiementId: "7",
};

describe("relevé des déductions format", () => {
  it("rejects incomplete header/rows before generation", () => {
    expect(validateForXml({ ...header, idf: "" }, [row]).length).toBeGreaterThan(0);
    expect(validateForXml(header, []).length).toBeGreaterThan(0);
    expect(
      validateForXml(header, [{ ...row, num: "", nom: "" }]).length,
    ).toBeGreaterThan(0);
  });

  it("accepts a complete payload", () => {
    expect(validateForXml(header, [row])).toEqual([]);
  });

  it("generates XML with required EDI tags and valid format", () => {
    const xml = generateXml(header, [row]);
    expect(xml).toContain("<DeclarationReleveDeduction>");
    expect(xml).toContain("<releveDeductions>");
    expect(xml).toContain("<rd>");
    expect(xml).toContain("<refF>");
    expect(xml).toContain("<mht>78.7</mht>");
    expect(xml).toContain("<dfac>2025-11-01</dfac>");

    const issues = validateReleveXmlFormat(xml);
    expect(issues).toEqual([]);
    expect(isValidReleveXmlFormat(xml)).toBe(true);
  });

  it("detects malformed relevé XML", () => {
    const bad = `<?xml version="1.0"?><DeclarationReleveDeduction><idf>1</idf></DeclarationReleveDeduction>`;
    const issues = validateReleveXmlFormat(bad);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.message.includes("annee") || i.path.includes("annee"))).toBe(
      true,
    );
  });

  it("detects invalid date and decimal formats", () => {
    const xml = generateXml(header, [row])
      .replace("<dfac>2025-11-01</dfac>", "<dfac>01/11/2025</dfac>")
      .replace("<mht>78.7</mht>", "<mht>78,7</mht>");
    const issues = validateReleveXmlFormat(xml);
    expect(issues.some((i) => i.path.includes("dfac"))).toBe(true);
    expect(issues.some((i) => i.path.includes("mht"))).toBe(true);
  });

  it("round-trips generate → parse", () => {
    const xml = generateXml(header, [row]);
    const parsed = parseXml(xml);
    expect(parsed.header.idf).toBe(header.idf);
    expect(parsed.header.annee).toBe(header.annee);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].num).toBe(row.num);
    expect(parsed.rows[0].mht).toBe(row.mht);
    expect(parsed.rows[0].nom).toBe(row.nom);
  });

  it("rejects non-XML content", () => {
    const issues = validateReleveXmlFormat("not xml");
    expect(issues[0]?.message).toMatch(/XML invalide/i);
  });
});
