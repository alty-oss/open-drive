import { encodePath } from "@/shared/files/urls";
import type { DownloadPayload, PublicPayload } from "./types";

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("not-found");
  return response.json();
}

export function loadPublicPath(value: string, signal: AbortSignal) {
  return readJson<PublicPayload>(
    `/api/public-path/${encodePath(value)}`,
    signal,
  );
}

export async function loadDownloadLink(
  token: string,
  signal: AbortSignal,
): Promise<DownloadPayload> {
  const payload = await readJson<DownloadPayload>(
    `/api/public-links/${encodeURIComponent(token)}`,
    signal,
  );
  if (payload.mode !== "download") throw new Error("wrong-link-type");
  return payload;
}

export async function loadPublicText(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("content-unavailable");
  return response.text();
}
