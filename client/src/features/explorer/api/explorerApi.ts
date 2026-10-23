import type { FileItem, FilePage } from "@/shared/files/types";
import type { StorageStats } from "@/shared/files/storageTypes";
import { normalizeFilePage } from "@/shared/files/pagination";

async function readFilePage(
  url: string,
  signal: AbortSignal,
  errorLabel: string,
): Promise<FilePage> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`${errorLabel} (${response.status})`);
  }
  const body: FilePage | FileItem[] = await response.json();
  return normalizeFilePage(body);
}

export const EXPLORER_PAGE_SIZE = 100;

export const EXPLORER_MAX_PAGE_SIZE = 200;

export function fetchExplorerPage(
  baseUrl: string,
  cursor: string | undefined,
  signal: AbortSignal,
  pageSize = EXPLORER_PAGE_SIZE,
) {
  const separator = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${separator}pageSize=${pageSize}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
  }`;
  return readFilePage(url, signal, "Unable to load files");
}

export function searchExplorer(
  query: string,
  cursor: string | undefined,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({ q: query, pageSize: "100" });
  if (cursor) params.set("cursor", cursor);
  return readFilePage(
    `/api/search?${params}`,
    signal,
    "Global search failed",
  );
}

export async function fetchStorageStats(): Promise<StorageStats> {
  const response = await fetch("/api/storage/stats");
  if (!response.ok) {
    throw new Error(`Unable to load statistics (${response.status})`);
  }
  return response.json();
}
