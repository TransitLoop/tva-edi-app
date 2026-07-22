import { strToU8, zipSync } from "fflate";

export type ZipEntry = {
  name: string;
  data: string | Uint8Array | ArrayBuffer | Blob;
};

async function toU8(data: ZipEntry["data"]): Promise<Uint8Array> {
  if (typeof data === "string") return strToU8(data);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(await data.arrayBuffer());
}

/** Build a ZIP Blob from named file entries (flat archive). */
export async function buildZipBlob(entries: ZipEntry[]): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    files[entry.name] = await toU8(entry.data);
  }
  const zipped = zipSync(files, { level: 6 });
  // Copy into a fresh ArrayBuffer-backed view for BlobPart compatibility.
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return new Blob([copy], { type: "application/zip" });
}
