import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, HardDrive, Loader2, X } from "lucide-react";
import ModalOverlay from "@/shared/ui/ModalOverlay";
import { cn } from "@/shared/ui/cn";
import { btn, scrollGutter } from "@/shared/ui/styles";
import { appModalHeader } from "@/shared/ui/dialogStyles";
import FileIcon from "@/shared/files/FileIcon";
import type { FileItem } from "@/shared/files/types";
import { logClientError } from "@/shared/lib/logger";
import { appendUniqueFiles } from "@/shared/files/pagination";
import { listMoveFolders } from "../api/fileActionsApi";

interface MoveModalProps {
  item: FileItem;
  currentPath: string;
  onClose: () => void;
  onMove: (itemPath: string, destFolder: string) => void | Promise<void>;
}

export default function MoveModal({
  item,
  currentPath,
  onClose,
  onMove,
}: MoveModalProps) {
  const [path, setPath] = useState(currentPath);
  const [folders, setFolders] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const parts = useMemo(() => path.split("/").filter(Boolean), [path]);

  const fetchFolders = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else {
      setLoading(true);
      setNextCursor(null);
    }
    try {
      const page = await listMoveFolders(path, cursor);
        const pageFolders = page.items.filter((file) => file.isFolder);
        setFolders((current) =>
          cursor
            ? appendUniqueFiles(current, pageFolders)
            : pageFolders,
        );
      setNextCursor(page.nextCursor);
    } catch (error) {
      logClientError("folders.move_destination_list_failed", error, { path });
      setFolders([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [path]);

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  const isInvalidDestination =
    item.path === path || (item.isFolder && path.startsWith(`${item.path}/`));

  const confirmMove = async () => {
    if (isInvalidDestination || moving) return;
    setMoving(true);
    await onMove(item.path, path);
    setMoving(false);
    onClose();
  };

  return (
    <ModalOverlay
      onClose={onClose}
      className="max-w-xl overflow-hidden p-0"
      ariaLabelledBy="move-dialog-title"
      ariaDescribedBy="move-dialog-description"
    >
      <div className={appModalHeader}>
        <div>
          <h2
            id="move-dialog-title"
            className="text-sm font-semibold text-text"
          >
            Move item
          </h2>
          <p
            id="move-dialog-description"
            className="mt-0.5 text-xs text-muted"
          >
            Choose the destination folder.
          </p>
        </div>
        <button
          onClick={onClose}
          className={btn.icon}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-md bg-surface px-3 py-2 text-13">
          <div className="font-semibold text-muted">Movendo</div>
          <div className="mt-0.5 font-medium text-text [overflow-wrap:anywhere]">
            {item.path}
          </div>
        </div>

        <div className="overflow-hidden rounded-md bg-surface">
          <div className={cn("flex h-10 items-center gap-1 overflow-x-auto border-b border-border-subtle bg-surface px-2 text-xs", scrollGutter)}>
            <PathButton active={path === ""} onClick={() => setPath("")}>
              <HardDrive className="w-3.5 h-3.5" />
              My Drive
            </PathButton>
            {parts.map((part, index) => {
              const nextPath = parts.slice(0, index + 1).join("/");
              return (
                <span
                  key={nextPath}
                  className="flex items-center gap-1 shrink-0"
                >
                  <ChevronRight className="h-3 w-3 text-muted" />
                  <PathButton
                    active={nextPath === path}
                    onClick={() => setPath(nextPath)}
                  >
                    {part}
                  </PathButton>
                </span>
              );
            })}
          </div>

          <div className={cn("h-56 overflow-x-hidden overflow-y-auto bg-surface", scrollGutter)}>
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : folders.length === 0 && !nextCursor ? (
              <div className="flex h-full items-center justify-center text-xs text-muted">
                No folders here
              </div>
            ) : (
              <>
                {folders.map((folder) => (
                  <button
                    key={folder.path}
                    type="button"
                    onClick={() => setPath(folder.path)}
                    disabled={
                      item.isFolder && folder.path.startsWith(`${item.path}/`)
                    }
                    className="flex h-10 w-full items-center gap-2 border-b border-border-subtle px-3 text-left text-xs text-text hover:bg-state-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FileIcon name={folder.name} isFolder size="xs" />
                    <span className="min-w-0 truncate">{folder.name}</span>
                  </button>
                ))}
                {nextCursor ? (
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-center text-xs font-semibold text-accent-strong hover:bg-state-hover"
                    disabled={loadingMore}
                    onClick={() => void fetchFolders(nextCursor)}
                  >
                    {loadingMore ? "Loading…" : "Load more folders"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="text-xs">
          <div className="font-semibold text-muted">Destination</div>
          <div className="mt-0.5 font-mono text-[11px] text-text [overflow-wrap:anywhere]">
            {path || "/"}
          </div>
        </div>

        {isInvalidDestination && (
          <div className="text-xs text-danger">
            Choose a different folder that is not inside the selected item.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={cn(btn.outlined, "h-9 px-4 text-sm")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmMove}
            disabled={isInvalidDestination || moving}
            className={cn(btn.primary, "h-9 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40")}
          >
            {moving ? "Moving..." : "Move to this folder"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function PathButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border-none px-1.5 text-xs",
        active
          ? "bg-state-selected font-semibold text-accent-strong"
          : "bg-transparent font-medium text-muted-strong",
      )}
    >
      {children}
    </button>
  );
}
