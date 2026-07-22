import type {
  AppMode,
  DeclarationHeader,
  DeductionRow,
  NonResidentRow,
} from "../types";

const STORAGE_KEY = "tva-edi-autosave-v1";

export type AutosaveSnapshot = {
  version: 1;
  savedAt: string;
  mode: AppMode;
  header: DeclarationHeader;
  rows: DeductionRow[];
  nrRows: NonResidentRow[];
  showAdvanced: boolean;
};

export function loadAutosave(): AutosaveSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AutosaveSnapshot;
    if (data?.version !== 1 || !data.header) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeAutosave(snapshot: Omit<AutosaveSnapshot, "version" | "savedAt">) {
  const payload: AutosaveSnapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    ...snapshot,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload.savedAt;
}

export function clearAutosave() {
  localStorage.removeItem(STORAGE_KEY);
}
