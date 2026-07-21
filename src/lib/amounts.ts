export function toNumber(value: number | string | ""): number {
  if (value === "" || value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Format like the DGI sample: 78.7, 10.0, 86.57 */
export function formatXmlNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number(rounded.toFixed(2)).toString();
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeTvaTtc(mht: number, tx: number): { tva: number; ttc: number } {
  const tva = round2((mht * tx) / 100);
  const ttc = round2(mht + tva);
  return { tva, ttc };
}

/** Accepts YYYY-MM-DD or DD/MM/YYYY and returns YYYY-MM-DD for EDI. */
export function normalizeDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const fr = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const [, d, m, y] = fr;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return trimmed;
}
