import { useMemo } from "react";
import type { FileItem } from "@/shared/files/types";
import type { SortDir, SortKey } from "../model/types";
import { sortFileItems } from "../model/sorting";

interface UseFileViewOptions {
  files: FileItem[];
  sortKey: SortKey;
  sortDir: SortDir;
}

export function useFileView({
  files,
  sortKey,
  sortDir,
}: UseFileViewOptions) {
  const sortedFiltered = useMemo(
    () => sortFileItems(files, sortKey, sortDir),
    [files, sortKey, sortDir],
  );

  return {
    filtered: files,
    sortedFiltered,
    visibleFiles: sortedFiltered,
    sortKey,
    sortDir,
  };
}
