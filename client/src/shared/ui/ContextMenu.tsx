import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Download,
  Edit3,
  Eye,
  FilePlus,
  FolderInput,
  FolderPlus,
  Globe2,
  Info,
  Link2,
  LockKeyhole,
  Settings2,
  RotateCcw,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useEscapeKey } from "@/shared/hooks/useEscapeKey";
import { useMenuNavigation } from "@/shared/hooks/useMenuNavigation";
import { cn } from "@/shared/ui/cn";
import { surface, z } from "@/shared/ui/styles";

interface ContextMenuProps {
  x: number;
  y: number;
  mode: "file" | "area";
  isFolder: boolean;
  isTrash: boolean;
  selectedCount: number;
  onClose: () => void;
  onPreview: () => void;
  onOpenFolderInNewTab: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDetails: () => void;
  isEditable: boolean;
  onCopy: () => void;
  onAccess: () => void;
  onToggleVisibility: () => void;
  isPublic: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  onRename: () => void;
  onMove: () => void;
  onBatchDelete: () => void;
  onBatchDownload: () => void;
  onUpload: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onPaste: () => void;
  canPaste: boolean;
  onDownloadAll: () => void;
}

export default function ContextMenu({
  x,
  y,
  mode,
  isFolder,
  isTrash,
  selectedCount,
  onClose,
  onPreview,
  onOpenFolderInNewTab,
  isFavorite,
  onToggleFavorite,
  onEdit,
  onDetails,
  isEditable,
  onCopy,
  onAccess,
  onToggleVisibility,
  isPublic,
  onDownload,
  onDelete,
  onRestore,
  onPermanentDelete,
  onRename,
  onMove,
  onBatchDelete,
  onBatchDownload,
  onUpload,
  onNewFolder,
  onNewFile,
  onPaste,
  canPaste,
  onDownloadAll,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, onClose);
  useEscapeKey(onClose);
  const menuNavigation = useMenuNavigation(ref);

  const [pos, setPos] = useState({ top: y, left: x });

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const newTop =
        y + rect.height > window.innerHeight
          ? Math.max(0, window.innerHeight - rect.height - 8)
          : y;
      const newLeft =
        x + rect.width > window.innerWidth
          ? Math.max(0, window.innerWidth - rect.width - 8)
          : x;
      setPos({ top: newTop, left: newLeft });
    }
  }, [x, y]);

  const isMulti = selectedCount > 1;





  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={mode === "area" ? "Actions for the current folder" : "Actions for the item"}
      aria-orientation="vertical"
      tabIndex={-1}
      onKeyDown={menuNavigation.onKeyDown}
      className={cn(
        surface.popover,
        "animate-fade-in fixed min-w-52 py-1",
        z.contextMenu,
      )}
      style={pos}
    >
      {mode === "area" ? (
        <>
          <MenuItem icon={<Upload />} onClick={onUpload}>
            Upload files
          </MenuItem>
          <MenuItem icon={<FilePlus />} onClick={onNewFile}>
            New file
          </MenuItem>
          <MenuItem icon={<FolderPlus />} onClick={onNewFolder}>
            New folder
          </MenuItem>
          {canPaste && (
            <MenuItem icon={<Copy />} onClick={onPaste}>
              Paste
            </MenuItem>
          )}
          <Separator />
          <MenuItem icon={<Download />} onClick={onDownloadAll}>
            Download all (.zip)
          </MenuItem>
        </>
      ) : isMulti ? (
        <>
          <div className="select-none px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            {selectedCount} selecteds
          </div>
          <Separator />
          {!isTrash && (
            <MenuItem icon={<Download />} onClick={onBatchDownload}>
              Download selected
            </MenuItem>
          )}
          <Separator />
          <MenuItem icon={<Trash2 />} onClick={onBatchDelete} danger>
            {isTrash ? "Delete from trash" : "Delete selected items"}
          </MenuItem>
        </>
      ) : isTrash ? (
        <>
          {!isFolder && (
            <>
              <MenuItem icon={<Eye />} onClick={onPreview}>
                Preview
              </MenuItem>
              <MenuItem icon={<Download />} onClick={onDownload}>
                Download
              </MenuItem>
              <Separator />
            </>
          )}
          <MenuItem icon={<RotateCcw />} onClick={onRestore}>
            Restore
          </MenuItem>
          <Separator />
          <MenuItem icon={<Trash2 />} onClick={onPermanentDelete} danger>
            Delete from trash
          </MenuItem>
        </>
      ) : (
        <>
          {isFolder && (
            <>
              <MenuItem icon={<FolderPlus />} onClick={onOpenFolderInNewTab}>
                Open in new tab
              </MenuItem>
              <MenuItem
                icon={<Star className={cn(isFavorite && "fill-current")} />}
                onClick={onToggleFavorite}
              >
                {isFavorite ? "Remove from favorites" : "Add to favorites"}
              </MenuItem>
              <Separator />
            </>
          )}
          {!isFolder && (
            <>
              <MenuItem icon={<Eye />} onClick={onPreview}>
                Preview
              </MenuItem>
              {isEditable && (
                <MenuItem icon={<Edit3 />} onClick={onEdit}>
                  Edit
                </MenuItem>
              )}
              {isPublic ? (
                <MenuItem icon={<Link2 />} onClick={onCopy}>
                  Copy public link
                </MenuItem>
              ) : null}
              <MenuItem icon={<Download />} onClick={onDownload}>
                Download
              </MenuItem>
              <MenuItem icon={<Info />} onClick={onDetails}>
                Details
              </MenuItem>
              <Separator />
            </>
          )}
          <MenuItem
            icon={isPublic ? <LockKeyhole /> : <Globe2 />}
            onClick={onToggleVisibility}
          >
            {isPublic ? "Make private" : "Make public"}
          </MenuItem>
          <MenuItem icon={<Settings2 />} onClick={onAccess}>
            Manage access and links
          </MenuItem>
          <Separator />
          <MenuItem icon={<Edit3 />} onClick={onRename}>
            Rename
          </MenuItem>
          <MenuItem icon={<FolderInput />} onClick={onMove}>
            Move to
          </MenuItem>
          {isFolder && (
            <MenuItem icon={<Info />} onClick={onDetails}>
              Details
            </MenuItem>
          )}
          <Separator />
          <MenuItem icon={<Trash2 />} onClick={onDelete} danger>
             Delete
          </MenuItem>
        </>
      )}
    </div>,
    document.body,
  );
}

function Separator() {
  return <div className="my-1 h-px bg-border" />;
}

interface MenuItemProps {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  hint?: string;
  icon?: ReactNode;
}

function MenuItem({ children, onClick, danger, hint, icon }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-full border-none bg-transparent px-3 py-2.5",
        "text-left text-13 transition-colors hover:bg-surface-highest",
        danger ? "text-danger" : "text-text",
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-3.5">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      {hint && <span className="ml-3 text-xs text-muted">{hint}</span>}
    </button>
  );
}
