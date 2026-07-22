import { describe, expect, it } from "vitest";
import {
  computeTvaTtc,
  formatXmlNumber,
  normalizeDate,
  round2,
  toNumber,
} from "../amounts";

describe("amounts", () => {
  it("parses numbers with comma or dot", () => {
    expect(toNumber("12,5")).toBe(12.5);
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber("")).toBe(0);
  });

  it("formats decimals like DGI samples", () => {
    expect(formatXmlNumber(78.7)).toBe("78.7");
    expect(formatXmlNumber(10)).toBe("10");
    expect(formatXmlNumber(86.57)).toBe("86.57");
  });

  it("computes TVA and TTC", () => {
    expect(computeTvaTtc(1000, 20)).toEqual({ tva: 200, ttc: 1200 });
    expect(computeTvaTtc(198.18, 20)).toEqual({
      tva: round2(39.636),
      ttc: round2(198.18 + 39.636),
    });
  });

  it("normalizes FR and ISO dates to AAAA-MM-JJ", () => {
    expect(normalizeDate("2025-10-15")).toBe("2025-10-15");
    expect(normalizeDate("08/01/2026")).toBe("2026-01-08");
    expect(normalizeDate("")).toBe("");
  });
});
