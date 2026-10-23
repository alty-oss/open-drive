import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import ModalOverlay from "@/shared/ui/ModalOverlay";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import {
  dialogActions,
  dialogDescription,
  dialogHeading,
  dialogHeadingIcon,
  dialogInput,
  dialogTitle,
} from "@/shared/ui/dialogStyles";

interface RenameModalProps {
  currentName: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}

export default function RenameModal({
  currentName,
  onClose,
  onRename,
}: RenameModalProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const dot = currentName.lastIndexOf(".");
    if (dot > 0) {
      input.setSelectionRange(0, dot);
    } else {
      input.select();
    }
  }, [currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== currentName) onRename(trimmed);
  };

  return (
    <ModalOverlay
      onClose={onClose}
      ariaLabelledBy="rename-dialog-title"
      ariaDescribedBy="rename-dialog-description"
    >
      <div className={dialogHeading}>
        <span className={dialogHeadingIcon}><Pencil /></span>
        <div>
          <h2 id="rename-dialog-title" className={dialogTitle}>Rename</h2>
          <p id="rename-dialog-description" className={dialogDescription}>
            Change the name without modifying the content.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          aria-label="New name"
          placeholder="New name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={cn(dialogInput)}
        />

        {name.trim() && name.trim() === currentName && (
          <p className="mt-1.5 text-xs text-muted">
            Enter a name different from the current one
          </p>
        )}

        <div className={dialogActions}>
          <button
            type="button"
            onClick={onClose}
            className={cn(btn.outlined, "h-9 px-4 text-sm")}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || name.trim() === currentName}
            className={cn(btn.primary, "h-9 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40")}
          >
            Rename
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
