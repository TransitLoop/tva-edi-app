import { describe, expect, it } from "vitest";
import {
  createDefaultHeader,
  defaultPeriodForRegime,
} from "../../types";

describe("default period", () => {
  it("uses the previous month for monthly regime", () => {
    expect(defaultPeriodForRegime("1", new Date(2026, 0, 15))).toEqual({
      annee: "2025",
      periode: "12",
    });
    expect(defaultPeriodForRegime("1", new Date(2026, 6, 22))).toEqual({
      annee: "2026",
      periode: "6",
    });
    expect(defaultPeriodForRegime("1", new Date(2026, 11, 1))).toEqual({
      annee: "2026",
      periode: "11",
    });
  });

  it("uses the previous quarter for quarterly regime", () => {
    expect(defaultPeriodForRegime("2", new Date(2026, 0, 15))).toEqual({
      annee: "2025",
      periode: "4",
    });
    expect(defaultPeriodForRegime("2", new Date(2026, 3, 1))).toEqual({
      annee: "2026",
      periode: "1",
    });
    expect(defaultPeriodForRegime("2", new Date(2026, 6, 22))).toEqual({
      annee: "2026",
      periode: "2",
    });
    expect(defaultPeriodForRegime("2", new Date(2026, 11, 1))).toEqual({
      annee: "2026",
      periode: "3",
    });
  });

  it("builds a default header for the previous quarter", () => {
    const header = createDefaultHeader(new Date(2026, 6, 22));
    expect(header.annee).toBe("2026");
    expect(header.regime).toBe("2");
    expect(header.periode).toBe("2");
  });
});
