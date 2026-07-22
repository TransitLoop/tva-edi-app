export type AppMode = "releve" | "non_residents";

export type DeclarationHeader = {
  idf: string;
  annee: string;
  periode: string;
  regime: string;
  modePaiementId: string;
};

/** Persistent company identity used to prefill declarations. */
export type CompanyProfile = {
  idf: string;
  raisonSociale: string;
  adresse: string;
};

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  idf: "",
  raisonSociale: "",
  adresse: "",
};

export type DeductionRow = {
  id: string;
  ordre: number;
  num: string;
  dfac: string;
  dpai: string;
  nom: string;
  ifFournisseur: string;
  ice: string;
  designation: string;
  mht: number | "";
  tx: number | "";
  tva: number | "";
  ttc: number | "";
  modePaiementId: string;
};

/** Liste des contribuables non résidents EDI (annexe TVA). */
export type NonResidentRow = {
  id: string;
  ordre: number;
  nom: string;
  adresse: string;
  identifiantFiscal: string;
  natureOperation: string;
  datePaiement: string;
  baseImposable: number | "";
  taux: number | "";
  tvaExigible: number | "";
};

export const TABLE_HEADERS = [
  "N° ordre",
  "N° facture",
  "Date facture",
  "Fournisseur",
  "IF fournisseur",
  "ICE",
  "Désignation",
  "Montant HT",
  "Taux TVA (%)",
  "Montant TVA",
  "Montant TTC",
] as const;

/** Extended headers used in the downloadable import template. */
export const TEMPLATE_HEADERS = [
  ...TABLE_HEADERS,
  "Date paiement",
  "Mode paiement",
] as const;

export const NON_RESIDENT_HEADERS = [
  "Nom et Prénom ou raison sociale",
  "Adresse à l'étranger",
  "N° d'identification fiscale",
  "Nature de l'opération",
  "Date de paiement",
  "Base imposable (HT)",
  "Taux (%)",
  "TVA exigible",
] as const;

export const DEFAULT_HEADER: DeclarationHeader = createDefaultHeader();

/**
 * Previous closed month (1–12) or quarter (1–4).
 * Rolls the year back when the previous period is in the prior year.
 */
export function defaultPeriodForRegime(
  regime: string,
  now: Date = new Date(),
): { annee: string; periode: string } {
  const year = now.getFullYear();

  if (regime === "1") {
    // Previous calendar month: Jan → Dec of previous year
    if (now.getMonth() === 0) {
      return { annee: String(year - 1), periode: "12" };
    }
    return { annee: String(year), periode: String(now.getMonth()) };
  }

  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  if (currentQuarter === 1) {
    return { annee: String(year - 1), periode: "4" };
  }
  return { annee: String(year), periode: String(currentQuarter - 1) };
}

/** Fresh declaration header for the previous closed period. */
export function createDefaultHeader(now: Date = new Date()): DeclarationHeader {
  const regime = "2";
  const { annee, periode } = defaultPeriodForRegime(regime, now);
  return {
    idf: "",
    annee,
    periode,
    regime,
    modePaiementId: "7",
  };
}

export function createEmptyRow(
  ordre: number,
  modePaiementId = "7",
): DeductionRow {
  return {
    id: crypto.randomUUID(),
    ordre,
    num: "",
    dfac: "",
    dpai: "",
    nom: "",
    ifFournisseur: "",
    ice: "",
    designation: "",
    mht: "",
    tx: "",
    tva: "",
    ttc: "",
    modePaiementId,
  };
}

export function createEmptyNonResidentRow(ordre: number): NonResidentRow {
  return {
    id: crypto.randomUUID(),
    ordre,
    nom: "",
    adresse: "",
    identifiantFiscal: "",
    natureOperation: "Services",
    datePaiement: "",
    baseImposable: "",
    taux: 20,
    tvaExigible: "",
  };
}
