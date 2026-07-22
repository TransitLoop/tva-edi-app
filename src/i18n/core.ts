import ar from "./locales/ar";
import en from "./locales/en";
import fr from "./locales/fr";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
  type TranslationDict,
} from "./types";

const dictionaries: Record<Locale, TranslationDict> = { fr, en, ar };

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export function loadStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function saveLocale(locale: Locale) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function createTranslator(locale: Locale): TranslateFn {
  const dict = dictionaries[locale] ?? dictionaries.fr;
  const fallback = dictionaries.fr;

  return (key, params) => {
    let text = dict[key] ?? fallback[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.split(`{{${name}}}`).join(String(value));
      }
    }
    return text;
  };
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function localeTag(locale: Locale): string {
  if (locale === "ar") return "ar-MA";
  if (locale === "en") return "en-GB";
  return "fr-FR";
}

export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDirection(locale);
}

export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_STORAGE_KEY,
  isLocale,
} from "./types";
export type { Locale, TranslationDict } from "./types";
