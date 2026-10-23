import { clientIdHeaders } from "@/shared/api/clientId";
import uploadConfig from "../../../../../shared/upload/upload.json";

export const CHUNK_SIZE = uploadConfig.chunkSizeBytes;

export class UploadFailure extends Error {}

export async function checksumBlob(blob: Blob): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {}
  return `${fallback} (HTTP ${response.status})`;
}

export function xhrError(xhr: XMLHttpRequest, fallback: string) {
  try {
    const body = JSON.parse(xhr.responseText);
    if (typeof body?.error === "string") return body.error;
  } catch {}
  return xhr.status ? `${fallback} (HTTP ${xhr.status})` : fallback;
}

interface InitializeChunkInput {
  filename: string;
  totalChunks: number;
  fileSize: number;
  destPath: string;
  autorename: boolean;
}

export async function initializeChunkUpload(
  input: InitializeChunkInput,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch("/api/upload-chunk/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    throw new UploadFailure(
      await responseError(response, "Unable to start the upload"),
    );
  }
  const body = await response.json();
  return body.uploadId;
}

export async function completeChunkUpload(uploadId: string): Promise<void> {
  const response = await fetch(`/api/upload-chunk/${uploadId}/complete`, {
    method: "POST",
    headers: clientIdHeaders(),
  });
  if (!response.ok) {
    throw new UploadFailure(
      await responseError(response, "Unable to complete the upload"),
    );
  }
}

export async function cleanupChunkUpload(uploadId: string): Promise<void> {
  await fetch(`/api/upload-chunk/${uploadId}`, { method: "DELETE" });
}

export async function hasUploadDuplicate(
  filename: string,
  destPath: string,
): Promise<boolean> {
  const query = destPath ? `?path=${encodeURIComponent(destPath)}` : "";
  const response = await fetch(`/api/check-duplicates${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filenames: [filename] }),
  });
  if (!response.ok) return false;
  const body = await response.json();
  return Array.isArray(body.duplicates) && body.duplicates.length > 0;
}

export async function ensureUploadFolders(
  path: string,
  folders: string[],
): Promise<boolean> {
  const response = await fetch("/api/ensure-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...clientIdHeaders() },
    body: JSON.stringify({ path, folders }),
  });
  return response.ok;
}
