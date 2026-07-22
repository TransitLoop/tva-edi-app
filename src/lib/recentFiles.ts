export type RecentFileKind = "csv" | "xlsx" | "xml";

export type RecentImportedFile = {
  id: string;
  name: string;
  kind: RecentFileKind;
  importedAt: string;
  /** UTF-8 text for csv/xml, base64 for xlsx */
  payload: string;
  /** Mode used when importing CSV/Excel (XML auto-detects). */
  modeHint: "releve" | "non_residents";
};

const STORAGE_KEY = "tva-edi-recent-imports-v1";
const MAX_RECENT = 4;
const MAX_PAYLOAD_BYTES = 1_500_000;

function bytesOf(payload: string): number {
  return new TextEncoder().encode(payload).length;
}

export function loadRecentImports(): RecentImportedFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as RecentImportedFile[];
    if (!Array.isArray(data)) return [];
    return data.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentImport(
  entry: Omit<RecentImportedFile, "id" | "importedAt">,
): RecentImportedFile[] {
  if (bytesOf(entry.payload) > MAX_PAYLOAD_BYTES) {
    return loadRecentImports();
  }
  const next: RecentImportedFile = {
    ...entry,
    id: crypto.randomUUID(),
    importedAt: new Date().toISOString(),
  };
  const existing = loadRecentImports().filter(
    (f) => f.name.toLowerCase() !== entry.name.toLowerCase(),
  );
  const list = [next, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function clearRecentImports() {
  localStorage.removeItem(STORAGE_KEY);
}

export function detectKind(fileName: string): RecentFileKind | null {
  const name = fileName.toLowerCase();
  if (name.endsWith(".xml")) return "xml";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
  return null;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function formatRecentLabel(entry: RecentImportedFile): string {
  const date = new Date(entry.importedAt);
  const when = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  return when ? `${entry.name} · ${when}` : entry.name;
}
