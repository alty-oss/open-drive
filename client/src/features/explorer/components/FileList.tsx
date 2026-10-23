import {
  useEffect,
  useRef,
  type KeyboardEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { Check, Link2, EllipsisVertical } from "lucide-react";
import { getFileIconType as getFileType } from "@/shared/files/fileTypes";
import { formatDate, formatSize } from "@/shared/lib/format";
import type { FileItem } from "@/shared/files/types";
import type { SortDir, SortKey } from "../model/types";
import { useFileDrag } from "../hooks/useFileDrag";
import { useFileItemInteraction } from "../hooks/useFileItemInteraction";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import FileIcon from "@/shared/files/FileIcon";
import VisibilityBadge from "@/shared/files/VisibilityBadge";




export const listGrid =
  "grid items-center gap-x-3.5 px-4.5 " +
  "grid-cols-[minmax(0,1fr)_72px_44px] " +
  "md:grid-cols-[minmax(190px,1fr)_90px_54px] " +
  "lg:grid-cols-[minmax(240px,1fr)_90px_150px_54px] " +
  "xl:grid-cols-[minmax(260px,1fr)_100px_110px_180px_58px]";

export const listHeader =
  "sticky top-0 z-20 h-11 border-b border-border-subtle bg-surface text-11 " +
  "font-medium tracking-[0.03em] text-muted uppercase";

export const listRowHeight = "h-13";
export const nameCell = "flex min-w-0 items-center gap-2.5";



export const typeColumn = "hidden xl:inline";
export const dateColumn = "hidden lg:inline";
const secondaryCell =
  "overflow-hidden text-13 text-ellipsis whitespace-nowrap text-muted";

interface FileListProps {
  files: FileItem[];
  selected: Set<string>;
  focusedIndex: number;
  activeCtxPath: string | null;
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

export type { SortDir, SortKey } from "../model/types";

export default function FileList({
  files,
  selected,
  focusedIndex,
  activeCtxPath,
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
}: FileListProps) {
  const { dragItem, dropTarget, dragProps } = useFileDrag(onMove);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (focusedIndex < 0) return;
    const file = files[focusedIndex];
    if (!file) return;
    rowRefs.current
      .get(file.path)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [files, focusedIndex]);

  return (
    <div className="min-h-full">
      <div className={cn(listGrid, listHeader)}>
        <span>Name</span>
        <span className={typeColumn}>Type</span>
        <span>Size</span>
        <span className={dateColumn}>Modified</span>
        <span aria-hidden="true" />
      </div>
      <div
        className="overflow-visible focus-visible:outline-none"
        ref={listboxRef}
        role="listbox"
        aria-label="Files in list"
        aria-multiselectable="true"
        aria-activedescendant={activeDescendant}
        tabIndex={0}
        onKeyDown={onListboxKeyDown}
      >
        <div className="min-h-full w-full bg-surface">
          {files.map((f) => {
            return (
              <FileRow
                key={f.path}
                file={f}
                selected={selected.has(f.path)}
                active={activeCtxPath === f.path}
                dropTarget={dropTarget === f.path}
                dragging={dragItem?.path === f.path}
                dragProps={dragProps(f)}
                onFocusPath={onFocusPath}
                onSelect={onSelect}
                onToggleSelect={onToggleSelect}
                onOpen={onOpen}
                onOpenInNewTab={onOpenInNewTab}
                onCopy={onCopy}
                onContextMenu={onContextMenu}
                setRef={(node) => {
                  if (node) rowRefs.current.set(f.path, node);
                  else rowRefs.current.delete(f.path);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface FileRowProps {
  file: FileItem;
  selected: boolean;
  active: boolean;
  dropTarget: boolean;
  dragging: boolean;
  dragProps: ReturnType<ReturnType<typeof useFileDrag>["dragProps"]>;
  onFocusPath: (path: string) => void;
  onSelect: (path: string, e: React.MouseEvent) => void;
  onToggleSelect: (path: string) => void;
  onOpen: (file: FileItem) => void;
  onOpenInNewTab: (file: FileItem) => void;
  onCopy: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  setRef: (node: HTMLDivElement | null) => void;
}

function FileRow({
  file,
  selected,
  active,
  dropTarget,
  dragging,
  dragProps,
  onFocusPath,
  onSelect,
  onToggleSelect,
  onOpen,
  onOpenInNewTab,
  onCopy,
  onContextMenu,
  setRef,
}: FileRowProps) {
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
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault();
      }}
      onAuxClick={(e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        onFocusPath(file.path);
        onOpenInNewTab(file);
      }}
      className={cn(
        listGrid,
        listRowHeight,
        "group relative w-full cursor-default border-b border-border-subtle text-text select-none last:border-b-0",
        "transition-[background-color] duration-100 ease-[ease]",
        selected || dropTarget
          ? "bg-state-selected"
          : active
            ? "bg-state-hover"
            : "hover:bg-state-hover",
        dragging && "opacity-40",
      )}
    >
      <div className={nameCell}>
        <button
          type="button"
          aria-label={
            selected ? `Deselect ${file.name}` : `Select ${file.name}`
          }
          aria-pressed={selected}
          className={cn(
            "flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-xs",
            "border border-border bg-surface p-0 text-transparent",
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
        <div className="shrink-0">
          <FileIcon name={file.name} isFolder={file.isFolder} size="sm" />
        </div>
        <span
          className={cn(
            "truncate",
            file.isFolder ? "font-medium" : "font-normal",
          )}
        >
          {file.name}
        </span>
        {!file.isTrash ? (
          <VisibilityBadge
            visibility={file.visibility}
            source={file.visibilitySource}
          />
        ) : null}
      </div>
      <span className={cn(typeColumn, secondaryCell)}>
        {file.isFolder ? "Folder" : fileTypeLabel(getFileType(file.name))}
      </span>
      <span className={cn(secondaryCell, "truncate")}>
        {file.isFolder ? "\u2014" : formatSize(file.size)}
      </span>
      <span className={cn(dateColumn, secondaryCell)}>
        {formatDate(file.date)}
      </span>
      <div className="flex gap-0.5 justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {!file.isFolder && !file.isTrash && (
          <IconButton ariaLabel="Copy link" onClick={() => onCopy(file)}>
            <Link2 className="size-3.5 text-muted" />
          </IconButton>
        )}
        <IconButton ariaLabel="More" onClick={(e) => onContextMenu(e, file)}>
          <EllipsisVertical className="size-3.5 text-muted" />
        </IconButton>
      </div>
    </div>
  );
}

function fileTypeLabel(type: ReturnType<typeof getFileType>) {
  const labels = {
    image: "Image",
    svg: "SVG",
    video: "Video",
    audio: "Audio",
    archive: "File",
    code: "Code",
    pdf: "PDF",
    text: "Document",
    file: "File",
  };
  return labels[type];
}

interface IconButtonProps {
  children: ReactNode;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
}

function IconButton({ children, onClick, ariaLabel }: IconButtonProps) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      aria-label={ariaLabel}
      className={cn(btn.icon, "size-7 opacity-80 hover:opacity-100")}
    >
      {children}
    </button>
  );
}
