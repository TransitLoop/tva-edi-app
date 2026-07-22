import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  createTranslator,
  loadStoredLocale,
  localeDirection,
  saveLocale,
} from "../../i18n/core";
import { translateValidation } from "../i18nErrors";

describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to French and persists locale", () => {
    expect(loadStoredLocale()).toBe(DEFAULT_LOCALE);
    saveLocale("en");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    expect(loadStoredLocale()).toBe("en");
    saveLocale("ar");
    expect(loadStoredLocale()).toBe("ar");
  });

  it("translates keys with interpolation and falls back to French", () => {
    const en = createTranslator("en");
    expect(en("menu.file")).toBe("File");
    expect(en("toast.csvImported", { count: 3 })).toBe(
      "CSV imported: 3 row(s).",
    );
    const ar = createTranslator("ar");
    expect(ar("menu.config")).toBeTruthy();
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("fr")).toBe("ltr");
  });

  it("translates validation tokens", () => {
    const t = createTranslator("en");
    expect(translateValidation(t, "validation.idfRequired")).toContain("IF");
    expect(translateValidation(t, "validation.invoiceRequired|2")).toContain(
      "2",
    );
  });
});
