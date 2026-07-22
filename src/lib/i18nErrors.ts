import type { TranslateFn } from "../i18n";

/** Translate validation tokens like `validation.invoiceRequired|3`. */
export function translateValidation(t: TranslateFn, token: string): string {
  const [key, n] = token.split("|");
  if (n) return t(key, { n });
  return t(key);
}
