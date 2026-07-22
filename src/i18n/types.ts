export type Locale = "fr" | "en" | "ar";

export const LOCALES: Locale[] = ["fr", "en", "ar"];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_STORAGE_KEY = "tva-edi-locale-v1";

export type TranslationDict = Record<string, string>;

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}
