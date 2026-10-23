import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Loader2, Save, X } from "lucide-react";
import type { FileItem } from "@/shared/files/types";
import { getCodeMirrorLanguage } from "../../lib/editorLanguage";
import { logClientError } from "@/shared/lib/logger";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import { appModalHeader } from "@/shared/ui/dialogStyles";
import CodeMirrorPane from "./CodeMirrorPane";
import { loadEditorFile, saveEditorFile } from "../../api/viewerApi";

interface EditorPaneProps {
  file: FileItem;
  isActive?: boolean;
  onToast: (msg: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onPreview: (file: FileItem) => void;
  onClose?: () => void;
}

export default function EditorPane({
  file,
  isActive = true,
  onToast,
  onDirtyChange,
  onPreview,
  onClose,
}: EditorPaneProps) {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveInProgressRef = useRef(false);
  const isDirty = content !== originalContent;
  const language = getCodeMirrorLanguage(file.name);

  const handleSave = useCallback(async () => {
    if (saveInProgressRef.current || !isDirty) return;
    saveInProgressRef.current = true;
    setSaving(true);
    try {
      await saveEditorFile(file.path, content);
      setOriginalContent(content);
      onToast("File saved");
    } catch (err) {
      logClientError("editor.save_failed", err, { filePath: file.path });
      onToast(err instanceof Error ? err.message : "Unable to save file");
    } finally {
      saveInProgressRef.current = false;
      setSaving(false);
    }
  }, [content, file.path, isDirty, onToast]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    let cancelled = false;
    const fetchContent = async () => {
      setLoading(true);
      setError("");
      try {
        const nextContent = await loadEditorFile(file.path);
        if (cancelled) return;
        setContent(nextContent);
        setOriginalContent(nextContent);
      } catch (err) {
        if (!cancelled) {
          logClientError("editor.load_failed", err, { filePath: file.path });
          setError(
            err instanceof Error ? err.message : "Unable to load file",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchContent();
    return () => {
      cancelled = true;
    };
  }, [file.path]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface">
      <div className={appModalHeader}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate max-w-[50vw] text-text">
            {file.name}
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] uppercase text-accent-strong shrink-0">
            {language}
          </span>
          {isDirty && (
            <span className="text-xs shrink-0 text-warning">
              Unsaved changes
            </span>
          )}
          {!isDirty && !loading && !error && (
            <span className="text-xs shrink-0 text-success">Saved</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onPreview(file)}
            aria-label="Preview file"
            className={cn(btn.outlined, "h-8 px-2 text-xs")}
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            aria-label="Save file"
            className={cn(btn.primary, "h-8 px-3 text-xs disabled:cursor-default disabled:opacity-40")}
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            Save
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
            aria-label="Close editor"
              className={btn.icon}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="relative z-0 flex-1 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-xs text-muted">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <CodeMirrorPane
            fileName={file.name}
            value={content}
            onChange={setContent}
          />
        )}
      </div>
    </div>
  );
}
