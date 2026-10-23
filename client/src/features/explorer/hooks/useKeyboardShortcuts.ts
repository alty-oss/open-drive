import { useEffect } from "react";

interface ShortcutHandlers {
  onSelectAll?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    element.isContentEditable
  );
}

export function useKeyboardShortcuts({
  onSelectAll,
  onDelete,
  onCopy,
  onCut,
  onPaste,
}: ShortcutHandlers) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        if (!onSelectAll) return;
        event.preventDefault();
        onSelectAll();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        if (!onCopy) return;
        event.preventDefault();
        onCopy();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
        if (!onCut) return;
        event.preventDefault();
        onCut();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        if (!onPaste) return;
        event.preventDefault();
        onPaste();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!onDelete) return;
        event.preventDefault();
        onDelete();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCopy, onCut, onDelete, onPaste, onSelectAll]);
}
