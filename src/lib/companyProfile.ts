import {
  DEFAULT_COMPANY_PROFILE,
  createDefaultHeader,
  type CompanyProfile,
  type DeclarationHeader,
} from "../types";

const STORAGE_KEY = "tva-edi-company-profile-v1";

export function loadCompanyProfile(): CompanyProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COMPANY_PROFILE };
    const data = JSON.parse(raw) as Partial<CompanyProfile>;
    return {
      idf: String(data.idf ?? "").trim(),
      raisonSociale: String(data.raisonSociale ?? "").trim(),
      adresse: String(data.adresse ?? "").trim(),
    };
  } catch {
    return { ...DEFAULT_COMPANY_PROFILE };
  }
}

export function saveCompanyProfile(profile: CompanyProfile): CompanyProfile {
  const cleaned: CompanyProfile = {
    idf: profile.idf.trim(),
    raisonSociale: profile.raisonSociale.trim(),
    adresse: profile.adresse.trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  return cleaned;
}

export function clearCompanyProfile() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Fresh declaration header prefilled from company profile when available. */
export function headerFromCompanyProfile(
  profile: CompanyProfile,
  base: DeclarationHeader = createDefaultHeader(),
): DeclarationHeader {
  return {
    ...base,
    idf: profile.idf || base.idf,
  };
}

export function hasCompanyProfile(profile: CompanyProfile): boolean {
  return Boolean(
    profile.idf.trim() ||
      profile.raisonSociale.trim() ||
      profile.adresse.trim(),
  );
}
