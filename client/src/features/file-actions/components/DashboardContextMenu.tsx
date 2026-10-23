import { isEditableFile } from "@/shared/files/fileTypes";
import type { FileItem } from "@/shared/files/types";
import type { ContextMenuState } from "@/features/explorer";
import ContextMenu from "@/shared/ui/ContextMenu";

interface DashboardContextMenuProps {
  ctxMenu: ContextMenuState | null;
  selectedCount: number;
  onClose: () => void;
  onPreview: (file: FileItem) => void;
  onOpenFolderInNewTab: (folder: FileItem) => void;
  isFavorite: (path: string) => boolean;
  onToggleFavorite: (folder: FileItem) => void;
  onEdit: (file: FileItem) => void;
  onDetails: (file: FileItem) => void;
  onCopy: (file: FileItem) => void;
  onAccess: (file: FileItem) => void;
  onToggleVisibility: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem | null) => void;
  onMove: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onRestore: (file: FileItem) => void;
  onPermanentDelete: (file: FileItem) => void;
  onBatchDelete: () => void;
  onBatchDownload: () => void;
  onUpload: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onPaste: () => void;
  canPaste: boolean;
  onDownloadAll: () => void;
}

export default function DashboardContextMenu({
  ctxMenu,
  selectedCount,
  onClose,
  onPreview,
  onOpenFolderInNewTab,
  isFavorite,
  onToggleFavorite,
  onEdit,
  onDetails,
  onCopy,
  onAccess,
  onToggleVisibility,
  onDownload,
  onRename,
  onMove,
  onDelete,
  onRestore,
  onPermanentDelete,
  onBatchDelete,
  onBatchDownload,
  onUpload,
  onNewFolder,
  onNewFile,
  onPaste,
  canPaste,
  onDownloadAll,
}: DashboardContextMenuProps) {
  if (!ctxMenu) return null;

  return (
    <ContextMenu
      x={ctxMenu.x}
      y={ctxMenu.y}
      mode={ctxMenu.mode}
      isFolder={ctxMenu.file?.isFolder ?? false}
      isTrash={ctxMenu.file?.isTrash ?? false}
      isPublic={ctxMenu.file?.visibility === "public"}
      selectedCount={ctxMenu.mode === "file" ? selectedCount : 0}
      onClose={onClose}
      onPreview={() => ctxMenu.file && onPreview(ctxMenu.file)}
      onOpenFolderInNewTab={() => {
        if (ctxMenu.file?.isFolder) onOpenFolderInNewTab(ctxMenu.file);
      }}
      isFavorite={!!ctxMenu.file && isFavorite(ctxMenu.file.path)}
      onToggleFavorite={() => {
        if (ctxMenu.file?.isFolder) onToggleFavorite(ctxMenu.file);
      }}
      onEdit={() => {
        if (ctxMenu.file && !ctxMenu.file.isFolder) onEdit(ctxMenu.file);
      }}
      onDetails={() => {
        if (ctxMenu.file) onDetails(ctxMenu.file);
      }}
      isEditable={
        !!(
          ctxMenu.file &&
          !ctxMenu.file.isFolder &&
          isEditableFile(ctxMenu.file.name)
        )
      }
      onCopy={() => ctxMenu.file && onCopy(ctxMenu.file)}
      onAccess={() => ctxMenu.file && onAccess(ctxMenu.file)}
      onToggleVisibility={() =>
        ctxMenu.file && onToggleVisibility(ctxMenu.file)
      }
      onDownload={() => ctxMenu.file && onDownload(ctxMenu.file)}
      onRename={() => onRename(ctxMenu.file ?? null)}
      onMove={() => ctxMenu.file && onMove(ctxMenu.file)}
      onDelete={() => ctxMenu.file && onDelete(ctxMenu.file)}
      onRestore={() => ctxMenu.file && onRestore(ctxMenu.file)}
      onPermanentDelete={() => ctxMenu.file && onPermanentDelete(ctxMenu.file)}
      onBatchDelete={onBatchDelete}
      onBatchDownload={onBatchDownload}
      onUpload={onUpload}
      onNewFolder={onNewFolder}
      onNewFile={onNewFile}
      onPaste={onPaste}
      canPaste={canPaste}
      onDownloadAll={onDownloadAll}
    />
  );
}
