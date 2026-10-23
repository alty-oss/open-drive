import { useCallback, useRef, useState } from "react";
import { readDroppedTree, type DroppedTree } from "../lib/uploadEntries";
import { logClientError } from "@/shared/lib/logger";

export function useDropZone(onTreeDrop: (tree: DroppedTree) => void) {
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      dragCounter.current++;
      setDragging(true);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDragging(false);
      dragCounter.current = 0;
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragging(false);



      readDroppedTree(e.dataTransfer)
        .then((tree) => {
          if (tree.entries.length > 0 || tree.emptyDirectories.length > 0) {
            onTreeDrop(tree);
          }
        })
        .catch((error) => logClientError("upload.drop_read_failed", error));
    },
    [onTreeDrop],
  );

  return {
    dragging,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
  };
}
