import type { FileItem } from "@/shared/files/types";




export type FileFilter = "trash" | "links" | null;

export type ViewMode = "list" | "gallery";
export type SortKey = "name" | "size" | "date";
export type SortDir = "asc" | "desc";

export interface WorkspaceTab {
  id: string;
  name: string;
  path: string;
  filter: FileFilter;
  search: string;
  sortKey: SortKey;
  sortDir: SortDir;
}

export interface ContextMenuState {
  x: number;
  y: number;
  file?: FileItem;
  mode: "file" | "area";
}
