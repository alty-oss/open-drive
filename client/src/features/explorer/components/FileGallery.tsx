import {
  useEffect,
  useRef,
  type KeyboardEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { Check, EllipsisVertical, Link2, Play } from "lucide-react";
import { fileUrl } from "@/shared/files/urls";
import { getFileIconType as getFileType } from "@/shared/files/fileTypes";
import { formatSize } from "@/shared/lib/format";
import { useFileDrag } from "../hooks/useFileDrag";
import { useFileItemInteraction } from "../hooks/useFileItemInteraction";
import type { FileItem } from "@/shared/files/types";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import FileIcon from "@/shared/files/FileIcon";
import VisibilityBadge from "@/shared/files/VisibilityBadge";


export const galleryShell = "min-h-full bg-surface p-3 md:p-5";
export const galleryGrid =
  "grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(145px,1fr))] " +
  "md:gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(178px,1fr))]";
export const cardBase =
  "relative min-w-0 overflow-hidden rounded-md bg-surface-alt shadow-e1";
export const cardMeta =
  "flex min-h-14.5 items-center gap-2 pt-2 pr-2.5 pb-2.25 pl-3 text-13 text-text";
const cardPreview = "aspect-[4/3] overflow-hidden bg-surface";
export const cardPreviewShape = cardPreview;

interface FileGalleryProps {
  files: FileItem[];
  selected: Set<string>;
  focusedPath: string | null;
  onFocusPath: (path: string) => void;
  onSelect: (path: string, e: React.MouseEvent) => void;
  onToggleSelect: (path: string) => void;
  onOpen: (file: FileItem) => void;
  onOpenInNewTab: (file: FileItem) => void;
  onCopy: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  onMove: (itemPath: string, destFolder: string) => void;
  listboxRef: Ref<HTMLDivElement>;
  activeDescendant?: string;
  onListboxKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export default function FileGallery({
  files,
  selected,
  focusedPath,
  onFocusPath,
  onSelect,
  onToggleSelect,
  onOpen,
  onOpenInNewTab,
  onCopy,
  onContextMenu,
  onMove,
  listboxRef,
  activeDescendant,
  onListboxKeyDown,
}: FileGalleryProps) {
  const { dragItem, dragProps } = useFileDrag(onMove);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!focusedPath) return;
    cardRefs.current
      .get(focusedPath)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusedPath]);

  return (
    <div className={galleryShell}>
      <div
        data-file-grid
        ref={listboxRef}
        className={cn(galleryGrid, "focus-visible:outline-none")}
        role="listbox"
        aria-label="Files in gallery"
        aria-multiselectable="true"
        aria-activedescendant={activeDescendant}
        tabIndex={0}
        onKeyDown={onListboxKeyDown}
      >
        {files.map((file) => {
          const isSelected = selected.has(file.path);
          const dragging = dragItem?.path === file.path;

          return (
            <FileCard
              key={file.path}
              file={file}
              selected={isSelected}
              dragging={dragging}
              dragProps={dragProps(file)}
              setRef={(node) => {
                if (node) cardRefs.current.set(file.path, node);
                else cardRefs.current.delete(file.path);
              }}
              onFocusPath={onFocusPath}
              onSelect={onSelect}
              onToggleSelect={onToggleSelect}
              onOpen={onOpen}
              onOpenInNewTab={onOpenInNewTab}
              onCopy={onCopy}
              onContextMenu={onContextMenu}
            />
          );
        })}
      </div>
    </div>
  );
}

interface FileCardProps {
  file: FileItem;
  selected: boolean;
  dragging: boolean;
  dragProps: ReturnType<ReturnType<typeof useFileDrag>["dragProps"]>;
  setRef: (node: HTMLDivElement | null) => void;
  onFocusPath: (path: string) => void;
  onSelect: (path: string, e: React.MouseEvent) => void;
  onToggleSelect: (path: string) => void;
  onOpen: (file: FileItem) => void;
  onOpenInNewTab: (file: FileItem) => void;
  onCopy: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
}

function FileCard({
  file,
  selected,
  dragging,
  dragProps,
  setRef,
  onFocusPath,
  onSelect,
  onToggleSelect,
  onOpen,
  onOpenInNewTab,
  onCopy,
  onContextMenu,
}: FileCardProps) {
  const interactionProps = useFileItemInteraction({
    file,
    onFocusPath,
    onSelect,
    onToggleSelect,
    onOpen,
    onContextMenu,
  });

  return (
    <div
      ref={setRef}
      {...dragProps}
      {...interactionProps}
      data-file-path={file.path}
      id={`file-option-${encodeURIComponent(file.path)}`}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        onFocusPath(file.path);
        onOpenInNewTab(file);
      }}
      className={cn(
        cardBase,
        "group cursor-default select-none",
        "transition-[background-color,box-shadow] duration-150",
        "hover:bg-surface-high hover:shadow-e2",
        "pointer-coarse:cursor-pointer pointer-coarse:touch-pan-y",
        dragging && "opacity-45",
      )}
    >
      {!file.isTrash ? (
        <div className="absolute top-2.25 right-2.25 z-2">
          <VisibilityBadge
            visibility={file.visibility}
            source={file.visibilitySource}
          />
        </div>
      ) : null}
      <button
        type="button"
        aria-label={
            selected ? `Deselect ${file.name}` : `Select ${file.name}`
        }
        aria-pressed={selected}
        className={cn(
          "absolute top-2.25 left-2.25 z-20 flex size-5.5 cursor-pointer items-center justify-center",
          "rounded-xs border border-border bg-surface text-transparent",
          "transition-[opacity,color,background-color] duration-100 ease-[ease]",
          selected && "border-accent bg-accent text-on-accent",
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onFocusPath(file.path);
          onToggleSelect(file.path);
        }}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>

      <div className="flex min-h-0 flex-col">
        <Preview file={file} />

        <div className={cardMeta}>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{file.name}</div>
            <div className="truncate text-xs text-muted">
              {file.isFolder
                ? "Folder"
                : `${formatSize(file.size)} - ${formatCardDate(file.date)}`}
            </div>
          </div>
          {!file.isFolder && !file.isTrash && (
            <IconButton ariaLabel="Copy link" onClick={() => onCopy(file)}>
              <Link2 className="w-3.5 h-3.5" />
            </IconButton>
          )}
          <IconButton
            ariaLabel="More"
            onClick={(event) => onContextMenu(event, file)}
          >
            <EllipsisVertical className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>

      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded-md border-2 border-transparent",
          selected && "border-accent",
        )}
      />
    </div>
  );
}

function formatCardDate(date: string) {
  return new Date(date).toLocaleDateString("en-US");
}

function Preview({ file }: { file: FileItem }) {
  const type = file.isFolder ? "file" : getFileType(file.name);

  if (!file.isFolder && (type === "image" || type === "svg")) {
    return (
      <div className={cardPreview}>
        <img
          data-drag-icon
          src={fileUrl(file)}
          alt={file.name}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-full bg-surface-alt object-contain"
        />
      </div>
    );
  }

  if (!file.isFolder && type === "video") {
    return (
      <div className={cn(cardPreview, "relative")}>
        <video
          data-drag-icon
          src={fileUrl(file)}
          preload="metadata"
          muted
          playsInline
          draggable={false}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/16">
          <div className="flex size-10 items-center justify-center rounded-full border border-white/18 bg-black/72 text-white">
            <Play className="size-4" fill="currentColor" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(cardPreview, "flex items-center justify-center p-3.5")}>
      <FileIcon name={file.name} isFolder={file.isFolder} size="lg" />
    </div>
  );
}

function IconButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      aria-label={ariaLabel}
      className={cn(btn.icon, "size-8 shrink-0")}
    >
      {children}
    </button>
  );
}
