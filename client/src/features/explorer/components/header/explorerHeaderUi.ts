import { Link2, Trash2 } from "lucide-react";
import type { FileFilter } from "../../model/types";

export const FILTER_LABELS: Record<Exclude<FileFilter, null>, string> = {
  trash: "Trash",
  links: "Links",
};

export const FILTER_ICONS = {
  trash: Trash2,
  links: Link2,
} satisfies Record<Exclude<FileFilter, null>, typeof Link2>;


export const SORT_OPTIONS = [
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "size:asc", label: "Menor size" },
  { value: "size:desc", label: "Largest size" },
  { value: "date:desc", label: "Most recent" },
  { value: "date:asc", label: "Oldest" },
] as const;


export function locationLabelFor(
  activeFilter: FileFilter,
  currentPath: string,
) {
  if (activeFilter) return FILTER_LABELS[activeFilter];
  if (!currentPath) return "My Drive";
  return currentPath.split("/").filter(Boolean).at(-1) || "My Drive";
}
