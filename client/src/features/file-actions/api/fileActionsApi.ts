import type { FileItem, FilePage } from "@/shared/files/types";
import { normalizeFilePage } from "@/shared/files/pagination";

export async function listMoveFolders(
  path: string,
  cursor?: string,
): Promise<FilePage> {
  const params = new URLSearchParams({ pageSize: "100" });
  if (path) params.set("path", path);
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/files?${params}`);
  if (!response.ok) {
    throw new Error(`Unable to load folders (${response.status})`);
  }
  const body: FilePage | FileItem[] = await response.json();
  return normalizeFilePage(body);
}
