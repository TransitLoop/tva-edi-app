export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_STORAGE_KEY,
  applyDocumentLocale,
  createTranslator,
  isLocale,
  loadStoredLocale,
  localeDirection,
  localeTag,
  saveLocale,
} from "./core";
export type { Locale, TranslateFn, TranslationDict } from "./core";
export { I18nProvider, useI18n, useT } from "./I18nProvider";
