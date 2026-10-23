import type { FileFilter } from "./types";

export type EmptyStateActionId =
  | "clear-search"
  | "upload"
  | "new-folder"
  | "go-to-drive";

export type HeaderMoreActionId = "paste" | "download-visible" | "empty-trash";

export function getEmptyStateActionIds(
  search: string,
  activeFilter: FileFilter,
): EmptyStateActionId[] {
  if (search) return ["clear-search"];
  if (!activeFilter) return ["upload", "new-folder"];
  if (activeFilter !== "trash") return ["go-to-drive"];
  return [];
}

export function getHeaderMoreActionIds(
  canPaste: boolean,
  activeFilter: FileFilter,
): HeaderMoreActionId[] {
  return [
    ...(canPaste ? (["paste"] as const) : []),
    "download-visible",
    ...(activeFilter === "trash" ? (["empty-trash"] as const) : []),
  ];
}
