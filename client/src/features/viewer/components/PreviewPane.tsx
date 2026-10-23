import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  Info,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { isEditableFile } from "@/shared/files/fileTypes";
import { fileUrl, publicFileUrl } from "@/shared/files/urls";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import { appModalHeader } from "@/shared/ui/dialogStyles";
import { getPreviewType } from "@/shared/files/fileTypes";
import type { FileItem } from "@/shared/files/types";
import { useImageViewport } from "../hooks/useImageViewport";
import { logClientError } from "@/shared/lib/logger";
import { fetchPreviewText } from "../api/viewerApi";
import PreviewContent from "./PreviewContent";

interface PreviewPaneProps {
  file: FileItem;
  isActive?: boolean;
  files: FileItem[];
  onOpenPreview: (file: FileItem) => void;
  onEdit: (file: FileItem) => void;
  onDetails?: (file: FileItem) => void;
  onClose?: () => void;
  onToast?: (message: string) => void;
}

export default function PreviewPane({
  file,
  isActive = true,
  files,
  onOpenPreview,
  onEdit,
  onDetails,
  onClose,
  onToast,
}: PreviewPaneProps) {
  const url = fileUrl(file);
  const absoluteUrl = `${location.origin}${publicFileUrl(file)}`;
  const mediaType = file.isFolder ? "unknown" : getPreviewType(file.name);
  const canEdit =
    !file.isFolder && !file.isTrash && isEditableFile(file.name);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState(false);
  const imageViewport = useImageViewport(
    file.path,
    mediaType === "image",
  );

  const previewFiles = useMemo(
    () =>
      files.filter((item) => {
        if (item.isFolder) return false;
        const type = getPreviewType(item.name);
        return type === "image" || type === "video" || type === "audio";
      }),
    [files],
  );
  const previewIndex = previewFiles.findIndex(
    (item) => item.path === file.path,
  );
  const prevFile = previewIndex > 0 ? previewFiles[previewIndex - 1] : null;
  const nextFile =
    previewIndex !== -1 && previewIndex < previewFiles.length - 1
      ? previewFiles[previewIndex + 1]
      : null;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isActive) return;
      if (mediaType === "markdown") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, input, textarea, select, [role='slider'], [contenteditable='true']",
        )
      ) {
        return;
      }
      if (event.key === "ArrowLeft" && prevFile) {
        event.preventDefault();
        onOpenPreview(prevFile);
      }
      if (event.key === "ArrowRight" && nextFile) {
        event.preventDefault();
        onOpenPreview(nextFile);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isActive, mediaType, nextFile, onOpenPreview, prevFile]);

  useEffect(() => {
    if (mediaType !== "text" && mediaType !== "markdown") return;
    const controller = new AbortController();
    setTextContent(null);
    setTextError(false);
    fetchPreviewText(url, controller.signal)
      .then((content) => {
        if (file.name.toLowerCase().endsWith(".json")) {
          try {
            setTextContent(JSON.stringify(JSON.parse(content), null, 2));
            return;
          } catch {}
        }
        setTextContent(content);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        logClientError("preview.text_load_failed", error, {
          filePath: file.path,
        });
        setTextError(true);
      });
    return () => controller.abort();
  }, [file.name, file.path, mediaType, url]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      onToast?.("URL copied!");
    } catch {
      const input = document.createElement("input");
      input.value = absoluteUrl;
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      onToast?.("URL copied!");
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface">
      <div className={appModalHeader}>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-text">
            {file.name}
          </span>
          <span className="truncate text-xs text-muted">
            {file.visibility === "public" ? absoluteUrl : file.path}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {mediaType === "image" && (
            <>
              <button
                onClick={() => imageViewport.zoom(imageViewport.scale * 0.85)}
                aria-label="Diminuir zoom"
                className={btn.icon}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={imageViewport.reset}
                aria-label="Reset zoom"
                className={cn(btn.outlined, "h-8 px-2 text-xs")}
              >
                <RotateCcw className="w-3 h-3" />
                {Math.round(imageViewport.scale * 100)}%
              </button>
              <button
                onClick={() => imageViewport.zoom(imageViewport.scale * 1.18)}
                aria-label="Increase zoom"
                className={btn.icon}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {mediaType !== "markdown" &&
            mediaType !== "video" &&
            mediaType !== "audio" && (
            <>
              <button
                onClick={() => prevFile && onOpenPreview(prevFile)}
                disabled={!prevFile}
                aria-label="Previous file"
                className={cn(btn.icon, "disabled:cursor-default disabled:opacity-30")}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => nextFile && onOpenPreview(nextFile)}
                disabled={!nextFile}
                aria-label="Next file"
                className={cn(btn.icon, "disabled:cursor-default disabled:opacity-30")}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(file)}
              aria-label="Edit file"
              className={cn(btn.outlined, "h-8 px-2 text-xs")}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {!file.isTrash && (
            <button
              onClick={() => onDetails?.(file)}
              aria-label="File details"
              className={btn.icon}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          {!file.isFolder ? (
            <>
              {file.visibility === "public" ? (
                <button
                  onClick={handleCopyUrl}
                  aria-label="Copy public URL"
                  className={btn.icon}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              ) : null}
              <button
                onClick={handleDownload}
                aria-label="Download file"
                className={btn.icon}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          ) : null}
          {onClose && (
            <button
              onClick={onClose}
                  aria-label="Close preview"
              className={btn.icon}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <PreviewContent
        mediaType={mediaType}
        file={file}
        url={url}
        isActive={isActive}
        prevFile={prevFile}
        nextFile={nextFile}
        onOpenPreview={onOpenPreview}
        onDownload={handleDownload}
        textContent={textContent}
        textError={textError}
        imageViewport={imageViewport}
      />
    </div>
  );
}
