import { useCallback, useRef, useState } from "react";
import type { FileItem } from "@/shared/files/types";

export function useSelection(visibleFiles: FileItem[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<string | null>(null);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    lastSelectedRef.current = null;
  }, []);

  const selectOnly = useCallback((path: string) => {
    setSelected(new Set([path]));
    lastSelectedRef.current = path;
  }, []);

  const toggleSelect = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    lastSelectedRef.current = path;
  }, []);

  const selectRangeTo = useCallback(
    (path: string) => {
      if (!lastSelectedRef.current) {
        selectOnly(path);
        return;
      }
      const paths = visibleFiles.map((file) => file.path);
      const a = paths.indexOf(lastSelectedRef.current);
      const b = paths.indexOf(path);
      if (a === -1 || b === -1) {
        selectOnly(path);
        return;
      }
      const [start, end] = a < b ? [a, b] : [b, a];
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(paths[i]);
        return next;
      });
    },
    [selectOnly, visibleFiles],
  );

  const selectAll = useCallback(() => {
    setSelected(new Set(visibleFiles.map((file) => file.path)));
    lastSelectedRef.current = visibleFiles.at(-1)?.path ?? null;
  }, [visibleFiles]);

  const handleSelect = useCallback(
    (path: string, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          lastSelectedRef.current = path;
          return next;
        });
        return;
      }
      if (e.shiftKey && lastSelectedRef.current) {
        const paths = visibleFiles.map((f) => f.path);
        const a = paths.indexOf(lastSelectedRef.current);
        const b = paths.indexOf(path);
        if (a !== -1 && b !== -1) {
          const [start, end] = a < b ? [a, b] : [b, a];
          setSelected((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) next.add(paths[i]);
            return next;
          });
        }
        return;
      }
      selectOnly(path);
    },
    [selectOnly, visibleFiles],
  );

  return {
    selected,
    setSelected,
    lastSelectedRef,
    handleSelect,
    clearSelection,
    selectOnly,
    toggleSelect,
    selectRangeTo,
    selectAll,
  };
}
