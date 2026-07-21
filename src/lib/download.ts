import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

async function browserDownload(filename: string, data: Blob | string) {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: "text/plain;charset=utf-8" })
      : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function saveTextFile(
  defaultName: string,
  content: string,
  filters: { name: string; extensions: string[] }[],
) {
  try {
    const path = await save({
      defaultPath: defaultName,
      filters,
    });
    if (!path) return false;
    await writeTextFile(path, content);
    return true;
  } catch {
    await browserDownload(defaultName, content);
    return true;
  }
}

export async function saveBinaryFile(
  defaultName: string,
  blob: Blob,
  filters: { name: string; extensions: string[] }[],
) {
  try {
    const path = await save({
      defaultPath: defaultName,
      filters,
    });
    if (!path) return false;
    const buffer = new Uint8Array(await blob.arrayBuffer());
    await writeFile(path, buffer);
    return true;
  } catch {
    await browserDownload(defaultName, blob);
    return true;
  }
}
