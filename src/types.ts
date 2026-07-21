export type DeclarationHeader = {
  idf: string;
  annee: string;
  periode: string;
  regime: string;
  modePaiementId: string;
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
