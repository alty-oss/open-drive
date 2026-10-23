import { useEffect, useRef, useState } from "react";
import { FilePlus } from "lucide-react";
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

interface NewFileModalProps {
  onClose: () => void;
  onCreate: (name: string) => void;
}

const TEMPLATES = [
  { label: "Markdown", extension: ".md" },
  { label: "Texto", extension: ".txt" },
  { label: "JSON", extension: ".json" },
  { label: "CSS", extension: ".css" },
];

export default function NewFileModal({ onClose, onCreate }: NewFileModalProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = name.trim();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (trimmed) onCreate(trimmed);
  };


  const applyExtension = (extension: string) => {
    const base = trimmed.replace(/\.[^./\\]*$/, "");
    setName(`${base || "sem-titulo"}${extension}`);
    inputRef.current?.focus();
  };

  return (
    <ModalOverlay
      onClose={onClose}
      ariaLabelledBy="new-file-dialog-title"
      ariaDescribedBy="new-file-dialog-description"
    >
      <div className={dialogHeading}>
        <span className={dialogHeadingIcon}><FilePlus /></span>
        <div>
          <h2 id="new-file-dialog-title" className={dialogTitle}>New file</h2>
          <p id="new-file-dialog-description" className={dialogDescription}>
            Choose a name or start from a file format.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          aria-label="Name of the new file"
          placeholder="file-name.md"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={cn(dialogInput)}
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {TEMPLATES.map((template) => (
            <button
              key={template.extension}
              type="button"
              onClick={() => applyExtension(template.extension)}
              className="h-8 cursor-pointer rounded-full border-0 bg-surface-high px-3 text-11 text-muted-strong hover:bg-accent-soft hover:text-on-accent-container"
            >
              {template.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted">
          The file is created empty and opened in the editor.
        </p>

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
            disabled={!trimmed}
            className={cn(btn.primary, "h-9 px-4 text-sm font-semibold disabled:opacity-40")}
          >
            Create
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
