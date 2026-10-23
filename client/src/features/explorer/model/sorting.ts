import type { SortDir, SortKey } from "./types";
import type { FileItem } from "@/shared/files/types";

export function sortFileItems(
  files: FileItem[],
  sortKey: SortKey,
  sortDir: SortDir,
) {
  const compare = (a: FileItem, b: FileItem) => {
    let result = 0;
    if (sortKey === "name") {
      result = a.name.localeCompare(b.name, "en-US", {
        sensitivity: "base",
      });
    } else if (sortKey === "size") {
      result = a.size - b.size;
    } else {
      result = new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    return sortDir === "asc" ? result : -result;
  };

  const folders = files.filter((file) => file.isFolder).sort(compare);
  const regularFiles = files.filter((file) => !file.isFolder).sort(compare);
  return [...folders, ...regularFiles];
}
