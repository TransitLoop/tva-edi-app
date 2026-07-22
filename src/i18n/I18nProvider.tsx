import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyDocumentLocale,
  createTranslator,
  loadStoredLocale,
  localeDirection,
  saveLocale,
  type Locale,
  type TranslateFn,
} from "./core";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
  dir: "ltr" | "rtl";
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => loadStoredLocale());

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const t = createTranslator(locale);
    return {
      locale,
      setLocale: (next) => {
        saveLocale(next);
        setLocaleState(next);
      },
      t,
      dir: localeDirection(locale),
    };
  }, [locale]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
