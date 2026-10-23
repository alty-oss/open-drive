import { useState, useRef, useCallback } from "react";
import { createDragGhost } from "../lib/createDragGhost";
import type { FileItem } from "@/shared/files/types";

export function useFileDrag(
  onMove: (itemPath: string, destFolder: string) => void,
) {
  const [dragItem, setDragItem] = useState<FileItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  const resetDragState = useCallback(() => {
    setDragItem(null);
    setDropTarget(null);
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current);
      ghostRef.current = null;
    }
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, item: FileItem) => {
    setDragItem(item);
    e.dataTransfer.setData("text/plain", item.path);
    e.dataTransfer.effectAllowed = "move";

    const ghost = createDragGhost(item.name, e.currentTarget as HTMLElement);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 16, 16);
    ghostRef.current = ghost;
  }, []);

  const handleDragEnd = resetDragState;

  const handleDragOver = (e: React.DragEvent, item: FileItem) => {
    if (!item.isFolder || !dragItem || dragItem.path === item.path) return;
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(item.path);
  };

  const handleDragLeave = () => setDropTarget(null);

  const handleDrop = (e: React.DragEvent, folder: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragItem && folder.isFolder && dragItem.path !== folder.path) {
      onMove(dragItem.path, folder.path);
    }
    resetDragState();
  };

  const dragProps = (f: FileItem) => ({
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => handleDragStart(e, f),
    onDragEnd: handleDragEnd,
    onDragOver: (e: React.DragEvent) => handleDragOver(e, f),
    onDragLeave: handleDragLeave,
    onDrop: (e: React.DragEvent) => handleDrop(e, f),
  });

  return { dragItem, dropTarget, dragProps };
}
