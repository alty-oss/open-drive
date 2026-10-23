import { useCallback, useEffect, useRef } from "react";
import type { FileItem } from "@/shared/files/types";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

interface UseFileItemInteractionOptions {
  file: FileItem;
  onFocusPath: (path: string) => void;
  onSelect: (path: string, event: React.MouseEvent) => void;
  onToggleSelect: (path: string) => void;
  onOpen: (file: FileItem) => void;
  onContextMenu: (event: React.MouseEvent, file: FileItem) => void;
}





export function useFileItemInteraction({
  file,
  onFocusPath,
  onSelect,
  onToggleSelect,
  onOpen,
  onContextMenu,
}: UseFileItemInteractionOptions) {
  const longPressTimerRef = useRef<number | null>(null);
  const doubleClickTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const lastPointerWasTouchRef = useRef(false);
  const suppressClickRef = useRef(false);
  const suppressDoubleClickRef = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      cancelLongPress();
      if (doubleClickTimerRef.current !== null) {
        window.clearTimeout(doubleClickTimerRef.current);
      }
    },
    [cancelLongPress],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      lastPointerWasTouchRef.current = event.pointerType === "touch";
      if (event.pointerType !== "touch") return;

      touchStartRef.current = { x: event.clientX, y: event.clientY };
      suppressClickRef.current = false;
      cancelLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        suppressClickRef.current = true;
        onFocusPath(file.path);
        onToggleSelect(file.path);
      }, LONG_PRESS_MS);
    },
    [cancelLongPress, file.path, onFocusPath, onToggleSelect],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "touch") return;
      const moved =
        Math.abs(event.clientX - touchStartRef.current.x) >
          MOVE_TOLERANCE_PX ||
        Math.abs(event.clientY - touchStartRef.current.y) >
          MOVE_TOLERANCE_PX;
      if (moved) cancelLongPress();
    },
    [cancelLongPress],
  );

  const handlePointerEnd = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (lastPointerWasTouchRef.current) {
        lastPointerWasTouchRef.current = false;
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onFocusPath(file.path);
        suppressDoubleClickRef.current = true;
        if (doubleClickTimerRef.current !== null) {
          window.clearTimeout(doubleClickTimerRef.current);
        }
        doubleClickTimerRef.current = window.setTimeout(() => {
          suppressDoubleClickRef.current = false;
          doubleClickTimerRef.current = null;
        }, 500);
        onOpen(file);
        return;
      }
      onFocusPath(file.path);
      onSelect(file.path, event);
    },
    [file, onFocusPath, onOpen, onSelect],
  );

  const handleDoubleClick = useCallback(() => {
    if (suppressDoubleClickRef.current) return;
    onFocusPath(file.path);
    onOpen(file);
  }, [file, onFocusPath, onOpen]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (lastPointerWasTouchRef.current || suppressClickRef.current) return;
      onFocusPath(file.path);
      onContextMenu(event, file);
    },
    [file, onContextMenu, onFocusPath],
  );

  return {
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
    onContextMenu: handleContextMenu,
  };
}
