import type { FileItem, FilePage } from "@/shared/files/types";

export function normalizeFilePage(body: FilePage | FileItem[]): FilePage {
  return Array.isArray(body)
    ? { items: body, nextCursor: null, total: body.length }
    : body;
}

export function appendUniqueFiles(
  current: FileItem[],
  incoming: FileItem[],
) {
  const known = new Set(current.map((item) => item.path));
  return [
    ...current,
    ...incoming.filter((item) => !known.has(item.path)),
  ];
}
