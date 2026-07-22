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

export const DEFAULT_HEADER: DeclarationHeader = {
  idf: "",
  annee: String(new Date().getFullYear()),
  periode: "4",
  regime: "2",
  modePaiementId: "7",
};

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
