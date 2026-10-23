import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { FileItem } from "@/shared/files/types";
import type { ContextMenuState, ViewMode } from "../model/types";

type KeyboardSelectionMode = "only" | "toggle" | "range";

interface UseFileBrowserKeyboardOptions {
  files: FileItem[];
  selected: Set<string>;
  viewMode: ViewMode;
  ctxMenu: ContextMenuState | null;
  onCloseContextMenu: () => void;
  onClearSelection: () => void;
  onKeyboardSelect: (path: string, mode: KeyboardSelectionMode) => void;
  onOpen: (file: FileItem) => void;
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return (
    element?.tagName === "INPUT" ||
    element?.tagName === "TEXTAREA" ||
    element?.tagName === "SELECT" ||
    Boolean(element?.isContentEditable)
  );
}

export function useFileBrowserKeyboard({
  files,
  selected,
  viewMode,
  ctxMenu,
  onCloseContextMenu,
  onClearSelection,
  onKeyboardSelect,
  onOpen,
}: UseFileBrowserKeyboardOptions) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [gridColumnCount, setGridColumnCount] = useState(1);
  const browserRef = useRef<HTMLDivElement | null>(null);
  const focusedIndex = useMemo(
    () => files.findIndex((file) => file.path === focusedPath),
    [files, focusedPath],
  );

  useEffect(() => {
    if (
      focusedPath &&
      (!files.some((file) => file.path === focusedPath) ||
        !selected.has(focusedPath))
    ) {
      setFocusedPath(null);
    }
  }, [files, focusedPath, selected]);

  useEffect(() => {
    if (!scrollElement || viewMode !== "gallery") {
      setGridColumnCount(1);
      return;
    }
    const grid = scrollElement.querySelector<HTMLElement>("[data-file-grid]");
    if (!grid) {
      setGridColumnCount(1);
      return;
    }
    const updateColumnCount = () => {
      const columns = window
        .getComputedStyle(grid)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length;
      setGridColumnCount(Math.max(1, columns));
    };
    updateColumnCount();
    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [files.length, scrollElement, viewMode]);

  const focusItem = (path: string) => {
    setFocusedPath(path);
    browserRef.current?.focus({ preventScroll: true });
  };
  const focusIndex = (index: number, extendSelection: boolean) => {
    const next = files[Math.max(0, Math.min(files.length - 1, index))];
    if (!next) return;
    setFocusedPath(next.path);
    browserRef.current?.focus({ preventScroll: true });
    onKeyboardSelect(next.path, extendSelection ? "range" : "only");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isEditableTarget(event.target)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (ctxMenu) onCloseContextMenu();
      else {
        setFocusedPath(null);
        onClearSelection();
        browserRef.current?.blur();
      }
      return;
    }
    if (files.length === 0) return;

    const navigationKeys = new Set([
      "ArrowDown",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "Enter",
      " ",
    ]);
    if (focusedIndex === -1) {
      if (navigationKeys.has(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    const currentIndex = focusedIndex;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      focusIndex(
        currentIndex + (viewMode === "gallery" ? gridColumnCount : 1),
        event.shiftKey,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      focusIndex(
        currentIndex - (viewMode === "gallery" ? gridColumnCount : 1),
        event.shiftKey,
      );
      return;
    }
    if (viewMode === "gallery" && event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      focusIndex(currentIndex + 1, event.shiftKey);
      return;
    }
    if (viewMode === "gallery" && event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      focusIndex(currentIndex - 1, event.shiftKey);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      event.stopPropagation();
      focusIndex(0, event.shiftKey);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      focusIndex(files.length - 1, event.shiftKey);
      return;
    }
    const focusedFile = files[focusedIndex];
    if (!focusedFile) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(focusedFile);
      return;
    }
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      onKeyboardSelect(focusedFile.path, "toggle");
    }
  };

  return {
    browserRef,
    focusedIndex,
    focusedPath,
    focusItem,
    handleKeyDown,
    scrollElement,
    setFocusedPath,
    setScrollElement,
  };
}
