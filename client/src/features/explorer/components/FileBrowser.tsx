import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  FolderPlus,
  HardDrive,
  Upload,
  X,
} from "lucide-react";
import type {
  ContextMenuState,
  FileFilter,
  ViewMode,
} from "../model/types";
import type { FileItem } from "@/shared/files/types";
import type { SortDir, SortKey } from "../model/types";
import { cn } from "@/shared/ui/cn";
import { scrollGutter } from "@/shared/ui/styles";
import { useDelayedFlag } from "@/shared/hooks/useDelayedFlag";
import FileGallery from "./FileGallery";
import FileList from "./FileList";
import ExplorerHeader from "./header/ExplorerHeader";
import EmptyState, { type EmptyStateAction } from "./EmptyState";
import {
  getEmptyStateActionIds,
  type EmptyStateActionId,
} from "../model/browserUi";
import {
  FileBrowserError,
  GlobalSearchLoading,
  PaginationFooter,
} from "./BrowserStates";
import { useFileBrowserKeyboard } from "../hooks/useFileBrowserKeyboard";

type KeyboardSelectionMode = "only" | "toggle" | "range";

interface FileBrowserProps {
  currentPath: string;
  activeFilter: FileFilter;
  viewMode: ViewMode;
  search: string;
  sortKey: SortKey;
  sortDir: SortDir;
  files: FileItem[];
  filteredCount: number;
  loading: boolean;

  refreshing?: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  paginationError: string | null;
  totalCount: number;
  selected: Set<string>;
  singleSelection: boolean;
  canPaste: boolean;
  ctxMenu: ContextMenuState | null;
  emptyMessage: string;
  emptyHint: string;
  onOpenSidebar: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (key: SortKey, dir: SortDir) => void;
  onUpload: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onDownloadAll: () => void;
  onEmptyTrash: () => void;
  onCopySelected: () => void;
  onCutSelected: () => void;
  onPaste: () => void;
  onDownloadSelected: () => void;
  onRenameSelected: () => void;
  onMoveSelected: () => void;
  onRestoreSelected: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onRetry: () => void;
  onLoadMore: () => void | Promise<void>;
  onKeyboardSelect: (path: string, mode: KeyboardSelectionMode) => void;
  onNavigate: (path: string) => void;
  onNavigateInNewTab: (path: string) => void;
  onMove: (itemPath: string, destFolder: string) => void;

  onPrefetchFolder?: (path: string) => void;
  onSelect: (path: string, e: React.MouseEvent) => void;
  onToggleSelect: (path: string) => void;
  onOpen: (file: FileItem) => void;
  onOpenInNewTab: (file: FileItem) => void;
  onCopy: (file: FileItem) => void;
  onItemInteraction: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  onAreaContextMenu: (state: ContextMenuState) => void;
  onCloseContextMenu: () => void;
}

export default function FileBrowser({
  currentPath,
  activeFilter,
  viewMode,
  search,
  sortKey,
  sortDir,
  files,
  filteredCount,
  loading,
  refreshing = false,
  error,
  hasMore,
  loadingMore,
  paginationError,
  totalCount,
  selected,
  singleSelection,
  canPaste,
  ctxMenu,
  emptyMessage,
  emptyHint,
  onOpenSidebar,
  onViewModeChange,
  onSearchChange,
  onSortChange,
  onUpload,
  onNewFolder,
  onNewFile,
  onDownloadAll,
  onEmptyTrash,
  onCopySelected,
  onCutSelected,
  onPaste,
  onDownloadSelected,
  onRenameSelected,
  onMoveSelected,
  onRestoreSelected,
  onDeleteSelected,
  onClearSelection,
  onRetry,
  onLoadMore,
  onKeyboardSelect,
  onNavigate,
  onNavigateInNewTab,
  onMove,
  onPrefetchFolder,
  onSelect,
  onToggleSelect,
  onOpen,
  onOpenInNewTab,
  onCopy,
  onItemInteraction,
  onContextMenu,
  onAreaContextMenu,
  onCloseContextMenu,
}: FileBrowserProps) {


  const contentTransitionKey = `${activeFilter ?? "drive"}:${viewMode}`;

  const showSearchLoading = useDelayedFlag(loading, 150);
  const showRefreshBar = useDelayedFlag(refreshing && !loading, 300);

  const keyboard = useFileBrowserKeyboard({
    files,
    selected,
    viewMode,
    ctxMenu,
    onCloseContextMenu,
    onClearSelection,
    onKeyboardSelect,
    onOpen,
  });
  const {
    browserRef,
    focusedIndex,
    focusedPath,
    focusItem,
    handleKeyDown,
    scrollElement,
    setFocusedPath,
    setScrollElement,
  } = keyboard;



  const locationKey = `${activeFilter ?? "drive"}:${currentPath}`;
  const scrollPositionsRef = useRef(new Map<string, number>());
  const scrollLocationRef = useRef(locationKey);
  const pendingScrollRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!scrollElement || scrollLocationRef.current === locationKey) return;
    scrollLocationRef.current = locationKey;
    const saved = scrollPositionsRef.current.get(locationKey) ?? 0;
    scrollElement.scrollTop = saved;
    pendingScrollRef.current = saved > 0 ? saved : null;
  }, [locationKey, scrollElement]);
  useLayoutEffect(() => {


    if (loading || !scrollElement || pendingScrollRef.current === null) return;
    scrollElement.scrollTop = pendingScrollRef.current;
    pendingScrollRef.current = null;
  }, [loading, scrollElement]);

  const prefetchableFolders = useMemo(
    () =>
      new Set(
        activeFilter
          ? []
          : files
              .filter((file) => file.isFolder && !file.isTrash)
              .map((file) => file.path),
      ),
    [activeFilter, files],
  );
  const prefetchTimerRef = useRef<{ path: string; timer: number } | null>(
    null,
  );
  useEffect(
    () => () => {
      if (prefetchTimerRef.current) {
        window.clearTimeout(prefetchTimerRef.current.timer);
      }
    },
    [],
  );
  const schedulePrefetch = (target: EventTarget) => {
    if (!onPrefetchFolder) return;
    const path = (target as HTMLElement)
      .closest<HTMLElement>("[data-file-path]")
      ?.dataset.filePath;
    if (!path || !prefetchableFolders.has(path)) return;
    if (prefetchTimerRef.current?.path === path) return;
    if (prefetchTimerRef.current) {
      window.clearTimeout(prefetchTimerRef.current.timer);
    }

    prefetchTimerRef.current = {
      path,
      timer: window.setTimeout(() => {
        prefetchTimerRef.current = null;
        onPrefetchFolder(path);
      }, 90),
    };
  };

  const commonProps = {
    files,
    selected,
    focusedPath,
    focusedIndex,
    activeCtxPath: ctxMenu?.file?.path ?? null,
    onFocusPath: focusItem,
    onSelect,
    onToggleSelect,
    onOpen,
    onOpenInNewTab,
    onCopy,
    onMove,
    onContextMenu,
    listboxRef: browserRef,
    activeDescendant: focusedPath
      ? `file-option-${encodeURIComponent(focusedPath)}`
      : undefined,
    onListboxKeyDown: handleKeyDown,
  };
  const emptyActionConfig = {
    "clear-search": {
      label: "Clear search",
      icon: X,
      onClick: () => onSearchChange(""),
      primary: true,
    },
    upload: {
      label: "Upload files",
      icon: Upload,
      onClick: onUpload,
      primary: true,
    },
    "new-folder": {
      label: "Create folder",
      icon: FolderPlus,
      onClick: onNewFolder,
    },
    "go-to-drive": {
      label: "Go to My Drive",
      icon: HardDrive,
      onClick: () => onNavigate(""),
      primary: true,
    },
  } satisfies Record<EmptyStateActionId, EmptyStateAction>;
  const emptyActions = getEmptyStateActionIds(search, activeFilter).map(
    (id) => emptyActionConfig[id],
  );

  return (
    <div className="h-full min-h-0 flex-1 min-w-0 flex flex-col z-1">
      <div
        role="region"
        aria-label="File explorer"
        aria-busy={loading || refreshing}
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-app focus:outline-none"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target === e.currentTarget || !target.closest("[draggable]")) {
            setFocusedPath(null);
            onClearSelection();
          }
        }}
        onContextMenu={(e) => {
          const target = e.target as HTMLElement;
          if (target === e.currentTarget || !target.closest("[draggable]")) {
            e.preventDefault();
            setFocusedPath(null);
            onClearSelection();
            onAreaContextMenu({ x: e.clientX, y: e.clientY, mode: "area" });
          }
        }}
      >
        <ExplorerHeader
          activeFilter={activeFilter}
          currentPath={currentPath}
          viewMode={viewMode}
          search={search}
          sortKey={sortKey}
          sortDir={sortDir}
          selectedCount={selected.size}
          singleSelection={singleSelection}
          canPaste={canPaste}
          onOpenSidebar={onOpenSidebar}
          onNavigate={onNavigate}
          onNavigateInNewTab={onNavigateInNewTab}
          onMove={onMove}
          onViewModeChange={onViewModeChange}
          onSearchChange={onSearchChange}
          onSortChange={onSortChange}
          onUpload={onUpload}
          onNewFolder={onNewFolder}
          onNewFile={onNewFile}
          onDownloadAll={onDownloadAll}
          onEmptyTrash={onEmptyTrash}
          onCopySelected={onCopySelected}
          onCutSelected={onCutSelected}
          onPaste={onPaste}
          onDownloadSelected={onDownloadSelected}
          onRenameSelected={onRenameSelected}
          onMoveSelected={onMoveSelected}
          onRestoreSelected={onRestoreSelected}
          onDeleteSelected={onDeleteSelected}
          onClearSelection={onClearSelection}
        />

        <div className="relative z-30 h-0" aria-hidden="true">
          {showRefreshBar ? (
            <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
              <div className="h-full w-2/5 bg-accent motion-safe:animate-refresh-progress" />
            </div>
          ) : null}
        </div>

        <div
          ref={setScrollElement}
          onScroll={(event) => {
            scrollPositionsRef.current.set(
              scrollLocationRef.current,
              event.currentTarget.scrollTop,
            );
          }}
          onPointerOver={(event) => {
            if (event.pointerType === "mouse") schedulePrefetch(event.target);
          }}
          onDragEnter={(event) => schedulePrefetch(event.target)}
          className={cn(
            "flex min-h-0 flex-1 flex-col bg-surface",
            scrollGutter,
            "overflow-x-hidden overflow-y-auto",
          )}
        >
          <div
            key={contentTransitionKey}
            className="flex min-h-0 flex-1 flex-col motion-safe:animate-content-enter"
          >
            {loading ? (
              showSearchLoading && search.trim() ? (
                <GlobalSearchLoading query={search.trim()} />
              ) : (
                <div className="flex-1" />
              )
            ) : error ? (
              <FileBrowserError message={error} onRetry={onRetry} />
            ) : filteredCount === 0 ? (
              <EmptyState
                message={emptyMessage}
                hint={emptyHint}
                actions={emptyActions}
              />
            ) : viewMode === "gallery" ? (
              <>
                <FileGallery {...commonProps} />
                <PaginationFooter
                  loaded={filteredCount}
                  total={totalCount}
                  hasMore={hasMore}
                  loading={loadingMore}
                  error={paginationError}
                  onLoadMore={onLoadMore}
                />
              </>
            ) : (
              <>
                <FileList {...commonProps} />
                <PaginationFooter
                  loaded={filteredCount}
                  total={totalCount}
                  hasMore={hasMore}
                  loading={loadingMore}
                  error={paginationError}
                  onLoadMore={onLoadMore}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
