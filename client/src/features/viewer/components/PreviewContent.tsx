import { lazy, Suspense } from "react";
import { Download, Loader2 } from "lucide-react";
import type { FileItem } from "@/shared/files/types";
import FileIcon from "@/shared/files/FileIcon";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import type { PreviewType } from "@/shared/files/fileTypes";
import type { useImageViewport } from "../hooks/useImageViewport";
import AudioPlayer from "./media/AudioPlayer";
import VideoPlayer from "./media/VideoPlayer";
import CodeMirrorPane from "./editor/CodeMirrorPane";

const MarkdownPreview = lazy(() => import("./previews/MarkdownPreview"));
const DocxPreview = lazy(() => import("./previews/DocxPreview"));
const FontPreview = lazy(() => import("./previews/FontPreview"));
const NotebookPreview = lazy(() => import("./previews/NotebookPreview"));

interface PreviewContentProps {
  mediaType: PreviewType | "unknown";
  file: FileItem;
  url: string;
  isActive: boolean;
  prevFile: FileItem | null;
  nextFile: FileItem | null;
  onOpenPreview: (file: FileItem) => void;
  onDownload: () => void;
  textContent: string | null;
  textError: boolean;
  imageViewport: ReturnType<typeof useImageViewport>;
}

export default function PreviewContent({
  mediaType,
  file,
  url,
  isActive,
  prevFile,
  nextFile,
  onOpenPreview,
  onDownload,
  textContent,
  textError,
  imageViewport,
}: PreviewContentProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
      {mediaType === "image" && (
        <div
          ref={imageViewport.viewportRef}
          className="flex h-full w-full touch-none items-center justify-center overflow-hidden select-none"
          onPointerDown={imageViewport.onPointerDown}
          onPointerMove={imageViewport.onPointerMove}
          onPointerUp={imageViewport.onPointerEnd}
          onPointerCancel={imageViewport.onPointerEnd}
          onDoubleClick={imageViewport.reset}
          style={{
            background: "var(--canvas-bg)",
            cursor: imageViewport.dragging ? "grabbing" : "grab",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          <img
            src={url}
            alt={file.name}
            className="pointer-events-none max-h-full max-w-full border object-contain select-none"
            style={{
              borderColor: "var(--border)",
              transform: `translate(${imageViewport.offset.x}px, ${imageViewport.offset.y}px) scale(${imageViewport.scale})`,
              transformOrigin: "center",
              transition: imageViewport.dragging ? "none" : "transform 90ms linear",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
          />
        </div>
      )}

      {mediaType === "video" && (
        <VideoPlayer
          src={url}
          fileName={file.name}
          active={isActive}
          onPrev={prevFile ? () => onOpenPreview(prevFile) : null}
          onNext={nextFile ? () => onOpenPreview(nextFile) : null}
        />
      )}

      {mediaType === "audio" && (
        <AudioPlayer
          src={url}
          fileName={file.name}
          active={isActive}
          onPrev={prevFile ? () => onOpenPreview(prevFile) : null}
          onNext={nextFile ? () => onOpenPreview(nextFile) : null}
        />
      )}

      {mediaType === "markdown" && (
        <div className="h-full w-full overflow-auto bg-surface [scrollbar-gutter:stable]">
          {textError ? (
            <p className="p-6 text-sm text-danger">Unable to load the file.</p>
          ) : textContent === null ? (
            <PreviewLoading />
          ) : (
            <div className="mx-auto max-w-5xl px-8 py-7">
              <Suspense fallback={<PreviewLoading />}>
                <MarkdownPreview content={textContent} />
              </Suspense>
            </div>
          )}
        </div>
      )}

      {mediaType === "text" && (
        <div className="h-full w-full overflow-auto [scrollbar-gutter:stable]">
          {textError ? (
            <p className="p-6 text-sm text-danger">Unable to load the file.</p>
          ) : textContent === null ? (
            <PreviewLoading />
          ) : (
            <CodeMirrorPane fileName={file.name} value={textContent} readOnly />
          )}
        </div>
      )}

      {mediaType === "pdf" && (
        <iframe
          src={url}
          title={`Preview of ${file.name}`}
          aria-label={file.name}
          className="h-full w-full border-0"
          style={{ background: "var(--canvas-bg)" }}
        />
      )}

      {mediaType === "docx" && (
        <div className="h-full w-full overflow-auto bg-document [color-scheme:light] [scrollbar-gutter:stable]">
          <Suspense fallback={<PreviewLoading />}>
            <DocxPreview url={url} />
          </Suspense>
        </div>
      )}

      {mediaType === "notebook" && (
        <div className="h-full w-full overflow-auto [scrollbar-gutter:stable]">
          <Suspense fallback={<PreviewLoading />}>
            <NotebookPreview url={url} />
          </Suspense>
        </div>
      )}

      {mediaType === "font" && (
        <div className="h-full w-full overflow-auto [scrollbar-gutter:stable]">
          <Suspense fallback={<PreviewLoading />}>
            <FontPreview url={url} name={file.name} />
          </Suspense>
        </div>
      )}

      {mediaType === "unknown" && (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
          <FileIcon name={file.name} isFolder={file.isFolder} size="lg" />
          <div>
            <div className="text-sm font-semibold text-text">{file.name}</div>
            <div className="mt-1 text-xs text-muted">
              {file.isFolder
                ? "Use the information panel to view size and content."
                : "This file type has no direct preview."}
            </div>
          </div>
          {!file.isFolder ? (
            <button
              onClick={onDownload}
              className={cn(btn.outlined, "h-8 cursor-pointer px-3 text-xs")}
            >
              <Download className="h-3.5 w-3.5" />
              Download file
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PreviewLoading() {
  return (
    <div className="flex items-center gap-2 p-6">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm text-muted">Loading...</span>
    </div>
  );
}
