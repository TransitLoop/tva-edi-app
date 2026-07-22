/**
 * Structural EDI XML format checks (Simpl-TVA style).
 * Used by unit tests and can be reused before export.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^-?\d+(\.\d+)?$/;

export type FormatIssue = { path: string; message: string };

function parseDocument(xml: string): { doc: Document; errors: FormatIssue[] } {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    return {
      doc,
      errors: [
        {
          path: "/",
          message: `XML invalide: ${parserError.textContent?.trim() ?? "parse error"}`,
        },
      ],
    };
  }
  return { doc, errors: [] };
}

function requireChild(
  parent: Element,
  tag: string,
  path: string,
  errors: FormatIssue[],
): Element | null {
  const el = parent.querySelector(`:scope > ${tag}`);
  if (!el) {
    errors.push({ path, message: `Balise <${tag}> manquante.` });
    return null;
  }
  return el;
}

function requireNonEmptyText(
  el: Element | null,
  path: string,
  errors: FormatIssue[],
): string {
  const value = el?.textContent?.trim() ?? "";
  if (!value) {
    errors.push({ path, message: "Valeur vide." });
  }
  return value;
}

function requireDate(
  el: Element | null,
  path: string,
  errors: FormatIssue[],
): void {
  const value = requireNonEmptyText(el, path, errors);
  if (value && !ISO_DATE.test(value)) {
    errors.push({
      path,
      message: `Date invalide « ${value} » (attendu AAAA-MM-JJ).`,
    });
  }
}

function requireDecimal(
  el: Element | null,
  path: string,
  errors: FormatIssue[],
): void {
  const value = requireNonEmptyText(el, path, errors);
  if (value && !DECIMAL.test(value)) {
    errors.push({
      path,
      message: `Nombre invalide « ${value} » (séparateur décimal « . »).`,
    });
  }
}

/** Validate DeclarationReleveDeduction EDI structure. */
export function validateReleveXmlFormat(xml: string): FormatIssue[] {
  const { doc, errors } = parseDocument(xml);
  if (errors.length) return errors;

  const root = doc.querySelector("DeclarationReleveDeduction");
  if (!root) {
    return [
      {
        path: "/",
        message: "Racine <DeclarationReleveDeduction> manquante.",
      },
    ];
  }

  for (const tag of ["idf", "annee", "periode", "regime"] as const) {
    requireNonEmptyText(
      requireChild(root, tag, `/DeclarationReleveDeduction/${tag}`, errors),
      `/DeclarationReleveDeduction/${tag}`,
      errors,
    );
  }

  const list = requireChild(
    root,
    "releveDeductions",
    "/DeclarationReleveDeduction/releveDeductions",
    errors,
  );
  if (!list) return errors;

  const rows = Array.from(list.querySelectorAll(":scope > rd"));
  if (rows.length === 0) {
    errors.push({
      path: "/DeclarationReleveDeduction/releveDeductions",
      message: "Au moins une balise <rd> est requise.",
    });
    return errors;
  }

  rows.forEach((rd, i) => {
    const base = `/DeclarationReleveDeduction/releveDeductions/rd[${i + 1}]`;
    requireNonEmptyText(requireChild(rd, "ordre", `${base}/ordre`, errors), `${base}/ordre`, errors);
    requireNonEmptyText(requireChild(rd, "num", `${base}/num`, errors), `${base}/num`, errors);
    requireNonEmptyText(requireChild(rd, "des", `${base}/des`, errors), `${base}/des`, errors);
    requireDecimal(requireChild(rd, "mht", `${base}/mht`, errors), `${base}/mht`, errors);
    requireDecimal(requireChild(rd, "tva", `${base}/tva`, errors), `${base}/tva`, errors);
    requireDecimal(requireChild(rd, "ttc", `${base}/ttc`, errors), `${base}/ttc`, errors);
    requireDecimal(requireChild(rd, "tx", `${base}/tx`, errors), `${base}/tx`, errors);
    requireDate(requireChild(rd, "dfac", `${base}/dfac`, errors), `${base}/dfac`, errors);
    requireDate(requireChild(rd, "dpai", `${base}/dpai`, errors), `${base}/dpai`, errors);

    const refF = requireChild(rd, "refF", `${base}/refF`, errors);
    if (refF) {
      requireNonEmptyText(requireChild(refF, "if", `${base}/refF/if`, errors), `${base}/refF/if`, errors);
      requireNonEmptyText(requireChild(refF, "nom", `${base}/refF/nom`, errors), `${base}/refF/nom`, errors);
      requireNonEmptyText(requireChild(refF, "ice", `${base}/refF/ice`, errors), `${base}/refF/ice`, errors);
    }

    const mp = requireChild(rd, "mp", `${base}/mp`, errors);
    if (mp) {
      requireNonEmptyText(requireChild(mp, "id", `${base}/mp/id`, errors), `${base}/mp/id`, errors);
    }
  });

  return errors;
}

/** Validate DeclarationNonResidents EDI structure. */
export function validateNonResidentXmlFormat(xml: string): FormatIssue[] {
  const { doc, errors } = parseDocument(xml);
  if (errors.length) return errors;

  const root = doc.querySelector("DeclarationNonResidents");
  if (!root) {
    return [
      {
        path: "/",
        message: "Racine <DeclarationNonResidents> manquante.",
      },
    ];
  }

  for (const tag of ["idf", "annee", "periode", "regime"] as const) {
    requireNonEmptyText(
      requireChild(root, tag, `/DeclarationNonResidents/${tag}`, errors),
      `/DeclarationNonResidents/${tag}`,
      errors,
    );
  }

  const list = requireChild(
    root,
    "contribuablesNonResidents",
    "/DeclarationNonResidents/contribuablesNonResidents",
    errors,
  );
  if (!list) return errors;

  const rows = Array.from(list.querySelectorAll(":scope > cnr"));
  if (rows.length === 0) {
    errors.push({
      path: "/DeclarationNonResidents/contribuablesNonResidents",
      message: "Au moins une balise <cnr> est requise.",
    });
    return errors;
  }

  rows.forEach((cnr, i) => {
    const base = `/DeclarationNonResidents/contribuablesNonResidents/cnr[${i + 1}]`;
    requireNonEmptyText(requireChild(cnr, "ordre", `${base}/ordre`, errors), `${base}/ordre`, errors);
    requireNonEmptyText(requireChild(cnr, "nom", `${base}/nom`, errors), `${base}/nom`, errors);
    requireNonEmptyText(requireChild(cnr, "adresse", `${base}/adresse`, errors), `${base}/adresse`, errors);
    requireNonEmptyText(requireChild(cnr, "idfNR", `${base}/idfNR`, errors), `${base}/idfNR`, errors);
    requireNonEmptyText(
      requireChild(cnr, "natureOperation", `${base}/natureOperation`, errors),
      `${base}/natureOperation`,
      errors,
    );
    requireDate(
      requireChild(cnr, "datePaiement", `${base}/datePaiement`, errors),
      `${base}/datePaiement`,
      errors,
    );
    requireDecimal(
      requireChild(cnr, "baseImposable", `${base}/baseImposable`, errors),
      `${base}/baseImposable`,
      errors,
    );
    requireDecimal(requireChild(cnr, "taux", `${base}/taux`, errors), `${base}/taux`, errors);
    requireDecimal(
      requireChild(cnr, "tvaExigible", `${base}/tvaExigible`, errors),
      `${base}/tvaExigible`,
      errors,
    );
  });

  return errors;
}

export function isValidReleveXmlFormat(xml: string): boolean {
  return validateReleveXmlFormat(xml).length === 0;
}

export function isValidNonResidentXmlFormat(xml: string): boolean {
  return validateNonResidentXmlFormat(xml).length === 0;
}
