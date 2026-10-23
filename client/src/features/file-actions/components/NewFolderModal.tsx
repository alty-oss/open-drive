import { useState, useRef, useEffect } from "react";
import { FolderPlus } from "lucide-react";
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

interface NewFolderModalProps {
  onClose: () => void;
  onCreate: (name: string) => void;
}

export default function NewFolderModal({
  onClose,
  onCreate,
}: NewFolderModalProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onCreate(trimmed);
  };

  return (
    <ModalOverlay
      onClose={onClose}
      ariaLabelledBy="new-folder-dialog-title"
      ariaDescribedBy="new-folder-dialog-description"
    >
      <div className={dialogHeading}>
        <span className={dialogHeadingIcon}><FolderPlus /></span>
        <div>
          <h2 id="new-folder-dialog-title" className={dialogTitle}>New folder</h2>
          <p id="new-folder-dialog-description" className={dialogDescription}>
            Create a folder in the current location.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          aria-label="Name of the new folder"
          placeholder="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={cn(dialogInput)}
        />

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
            disabled={!name.trim()}
            className={cn(btn.primary, "h-9 px-4 text-sm font-semibold disabled:opacity-40")}
          >
            Create
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
