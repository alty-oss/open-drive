import { encodePath } from "@/shared/files/urls";
import type { FileItem, FileMetadata, FilePage } from "@/shared/files/types";
import { normalizeFilePage } from "@/shared/files/pagination";

async function ensureOk(response: Response, fallback: string) {
  if (response.ok) return response;
  let message = fallback;
  try {
    const body = await response.json();
    if (typeof body?.error === "string") message = body.error;
  } catch {
    message = `${fallback} (HTTP ${response.status})`;
  }
  throw new Error(message);
}

export async function fetchPreviewText(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(url, { signal });
  await ensureOk(response, "Unable to load content");
  return response.text();
}

export async function fetchPreviewBuffer(
  url: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  await ensureOk(response, "Unable to load content");
  return response.arrayBuffer();
}

export async function fetchPreviewJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  await ensureOk(response, "Unable to load content");
  return response.json();
}

export async function fetchFileMetadata(path: string): Promise<FileMetadata> {
  const response = await fetch(`/api/metadata/${encodePath(path)}`);
  await ensureOk(response, `HTTP ${response.status}`);
  return response.json();
}

export async function loadEditorFile(path: string): Promise<string> {
  const response = await fetch(`/api/file-content/${encodePath(path)}`);
  if (response.status === 413) {
    throw new Error("File is too large to edit (max. 5MB)");
  }
  await ensureOk(response, "Unable to load file");
  const body = await response.json();
  return body.content;
}

export async function saveEditorFile(
  path: string,
  content: string,
): Promise<void> {
  const response = await fetch(`/api/file-content/${encodePath(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  await ensureOk(response, "Unable to save");
}

export async function loadSubtitleFile(path: string): Promise<string> {
  const response = await fetch(`/api/file-content/${encodePath(path)}`);
  await ensureOk(response, `Unable to read subtitle (${response.status})`);
  const body = await response.json();
  return body.content;
}

export async function listViewerFiles(
  path: string,
  cursor?: string,
): Promise<FilePage> {
  const params = new URLSearchParams({ pageSize: "100" });
  if (path) params.set("path", path);
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/files?${params}`);
  await ensureOk(response, `Unable to list files (${response.status})`);
  const body: FilePage | FileItem[] = await response.json();
  return normalizeFilePage(body);
}
