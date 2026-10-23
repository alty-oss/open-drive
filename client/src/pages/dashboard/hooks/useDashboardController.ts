import { useCallback, useRef } from "react";
import { logout } from "@/app/authApi";
import { useSocket, type FileChangeData } from "@/app/useSocket";
import { foldersAffectedBy } from "../model/fileChanges";
import {
  useFiles,
  useFileView,
  useGlobalSearch,
  useKeyboardShortcuts,
  useSelection,
  type FileFilter,
  type ViewMode,
} from "@/features/explorer";
import { useFileActions } from "@/features/file-actions";
import { useFavorites } from "@/features/favorites";
import {
  useClipboardPaste,
  useDropZone,
  useUploads,
  type DroppedTree,
} from "@/features/uploads";
import type { FileItem } from "@/shared/files/types";
import { useCoalescedCallback } from "@/shared/hooks/useCoalescedCallback";
import { useToast } from "@/shared/hooks/useToast";
import { useDashboardExplorer } from "./useDashboardExplorer";
import { useDashboardModal } from "./useDashboardModal";
import { useDashboardUiState } from "./useDashboardUiState";

export interface DashboardControllerOptions {
  onLogout: () => void;
}

export function useDashboardController({
  onLogout,
}: DashboardControllerOptions) {
  const toast = useToast();
  const navigationResetRef = useRef<() => void>(() => undefined);
  const clearViewRef = useRef<() => void>(() => undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const knownItemsRef = useRef(new Map<string, FileItem>());
  const ui = useDashboardUiState();
  const modal = useDashboardModal();

  const resetExplorerState = useCallback(
    () => navigationResetRef.current(),
    [],
  );
  const clearExplorerView = useCallback(() => clearViewRef.current(), []);
  const explorer = useDashboardExplorer({
    resetExplorerState,
    clearExplorerView,
    openPreview: modal.openPreview,
  });
  const search = explorer.activeTab?.search ?? "";
  const filesState = useFiles({
    currentPath: explorer.currentPath,
    activeFilter: explorer.activeFilter,
  });
  const globalSearch = useGlobalSearch(search);
  const fileView = useFileView({
    files: globalSearch.active ? globalSearch.files : filesState.files,
    sortKey: explorer.activeTab?.sortKey ?? "name",
    sortDir: explorer.activeTab?.sortDir ?? "asc",
  });
  const selection = useSelection(fileView.visibleFiles);

  const refreshAllCoalesced = useCoalescedCallback(filesState.refreshAll, 600);
  const refreshStatsCoalesced = useCoalescedCallback(
    filesState.fetchStats,
    1000,
  );

  clearViewRef.current = selection.clearSelection;
  navigationResetRef.current = () => clearViewRef.current();

  const favorites = useFavorites({ onToast: toast.show });
  const { refresh: refreshFavorites } = favorites;
  const refreshFavoritesCoalesced = useCoalescedCallback(refreshFavorites, 600);

  const refreshAllAndFavorites = useCallback(async () => {
    void refreshFavorites();
    await filesState.refreshAll();
  }, [filesState.refreshAll, refreshFavorites]);

  const upload = useUploads({
    currentPath: explorer.currentPath,
    refreshAll: refreshAllCoalesced,
    maxUploadSize: filesState.stats?.maxUploadSize,
    available: filesState.stats?.available,
    onToast: toast.show,
  });
  const actions = useFileActions({
    currentPath: explorer.currentPath,
    activeFilter: explorer.activeFilter,
    visibleFiles: fileView.visibleFiles,
    selected: selection.selected,
    clearSelection: selection.clearSelection,
    refreshFiles: filesState.refreshFiles,
    refreshAll: refreshAllAndFavorites,
    removeItems: filesState.removeItems,
    showToast: toast.show,
    openConfirm: modal.openConfirm,
    closeModal: modal.closeModal,
  });

  const handleLogout = useCallback(async () => {
    await logout();
    onLogout();
  }, [onLogout]);
  const folderActive = !explorer.activeFilter;
  const rememberItem = useCallback((item: FileItem) => {
    knownItemsRef.current.set(item.path, item);
    if (knownItemsRef.current.size > 500) {
      const oldestPath = knownItemsRef.current.keys().next().value;
      if (oldestPath) knownItemsRef.current.delete(oldestPath);
    }
  }, []);
  const selectedItem =
    selection.selected.size === 1
      ? fileView.visibleFiles.find((file) => selection.selected.has(file.path)) ??
        knownItemsRef.current.get(
          selection.selected.values().next().value ?? "",
        ) ??
        null
      : null;

  const handleCopySelection = useCallback(() => {
    if (!folderActive || selection.selected.size === 0) return;
    ui.setClipboard({
      mode: "copy",
      paths: Array.from(selection.selected),
    });
    toast.show(
      `${selection.selected.size} ${selection.selected.size === 1 ? "copied item" : "copied items"}`,
    );
  }, [folderActive, selection.selected, toast, ui]);

  const handleCutSelection = useCallback(() => {
    if (!folderActive || selection.selected.size === 0) return;
    ui.setClipboard({ mode: "cut", paths: Array.from(selection.selected) });
    toast.show(
      `${selection.selected.size} ${selection.selected.size === 1 ? "cut item" : "cut items"}`,
    );
  }, [folderActive, selection.selected, toast, ui]);

  const handlePasteClipboard = useCallback(async () => {
    if (!ui.clipboard || !folderActive) return;
    const pasted = await actions.handlePasteItems(
      ui.clipboard.paths,
      ui.clipboard.mode,
      explorer.currentPath,
    );
    if (pasted && ui.clipboard.mode === "cut") {
      ui.setClipboard(null);
      selection.clearSelection();
    }
  }, [actions, explorer.currentPath, folderActive, selection, ui]);

  const handleFilesUpload = useCallback(
    (files: FileList) => {
      if (folderActive) upload.handleUpload(files);
    },
    [folderActive, upload],
  );

  useKeyboardShortcuts({
    onSelectAll:
      modal.modal.kind === "none" && !ui.ctxMenu
        ? selection.selectAll
        : undefined,
    onDelete:
      modal.modal.kind === "none" &&
      !ui.ctxMenu &&
      selection.selected.size > 0
        ? actions.handleBatchDelete
        : undefined,
    onCopy:
      modal.modal.kind === "none" &&
      !ui.ctxMenu &&
      folderActive &&
      selection.selected.size > 0
        ? handleCopySelection
        : undefined,
    onCut:
      modal.modal.kind === "none" &&
      !ui.ctxMenu &&
      folderActive &&
      selection.selected.size > 0
        ? handleCutSelection
        : undefined,
    onPaste:
      modal.modal.kind === "none" &&
      !ui.ctxMenu &&
      ui.clipboard &&
      folderActive
        ? handlePasteClipboard
        : undefined,
  });
  useClipboardPaste(handleFilesUpload);

  const handleTreeDrop = useCallback(
    (tree: DroppedTree) => {
      if (folderActive) upload.handleUploadTree(tree);
    },
    [folderActive, upload],
  );
  const dropZone = useDropZone(handleTreeDrop);
  const socket = useSocket(
    useCallback(
      (date: FileChangeData) => {

        refreshFavoritesCoalesced();
        const folders = foldersAffectedBy(date);
        if (
          explorer.activeFilter ||
          !folders ||
          folders.has(explorer.currentPath)
        ) {
          refreshAllCoalesced();
        } else {

          refreshStatsCoalesced();
        }
      },
      [
        explorer.activeFilter,
        explorer.currentPath,
        refreshAllCoalesced,
        refreshFavoritesCoalesced,
        refreshStatsCoalesced,
      ],
    ),
    { onUnauthenticated: onLogout },
  );

  const handleFilterChange = (filter: FileFilter) => {
    explorer.setBrowserLocation("", filter);
    ui.setSidebarOpen(false);
  };
  const handleSearchChange = useCallback(
    (value: string) => explorer.updateActiveTabView({ search: value }),
    [explorer.updateActiveTabView],
  );
  const handleSortChange = useCallback(
    (sortKey: typeof fileView.sortKey, sortDir: typeof fileView.sortDir) =>
      explorer.updateActiveTabView({ sortKey, sortDir }),
    [explorer.updateActiveTabView],
  );
  const handleViewModeChange = (mode: ViewMode) => {
    ui.changeViewMode(mode);
    selection.clearSelection();
  };
  const handleKeyboardSelect = useCallback(
    (path: string, mode: "only" | "toggle" | "range") => {
      if (mode === "toggle") selection.toggleSelect(path);
      else if (mode === "range") selection.selectRangeTo(path);
      else selection.selectOnly(path);
    },
    [selection],
  );
  const closeContext = () => ui.setCtxMenu(null);
  const closeAnd = (fn: () => void) => {
    fn();
    closeContext();
  };

  const requestModalClose = useCallback(() => {
    if (
      modal.modal.kind === "editor" &&
      modal.modal.dirty &&
      !window.confirm("Unsaved changes. Close without saving?")
    ) {
      return;
    }
    modal.closeModal();
  }, [modal]);
  const openPreview = useCallback(
    (file: FileItem) => {
      if (
        modal.modal.kind === "editor" &&
        modal.modal.dirty &&
        !window.confirm("Unsaved changes. Leave the editor?")
      ) {
        return;
      }
      modal.openPreview(file);
    },
    [modal],
  );
  const openEditor = useCallback(
    (file: FileItem) => {
      if (
        modal.modal.kind === "editor" &&
        modal.modal.dirty &&
        modal.modal.file.path !== file.path &&
        !window.confirm("Unsaved changes. Switch files?")
      ) {
        return;
      }
      modal.openEditor(file);
    },
    [modal],
  );

  const emptyMessage = search
    ? "No results found"
    : explorer.activeFilter
      ? "Trash is empty"
      : explorer.currentPath
        ? "Folder is empty"
        : "No files yet";
  const emptyHint = search
    ? `No file in My Drive matches "${search}"`
    : explorer.activeFilter
      ? "Deleted files appear here before permanent removal"
      : 'Drop files here or use "Upload"';

  return {
    actions,
    closeAnd,
    closeContext,
    dropZone,
    emptyHint,
    emptyMessage,
    explorer,
    favorites,
    fileInputRef,
    filesState,
    fileView,
    folderActive,
    globalSearch,
    handleCopySelection,
    handleCutSelection,
    handleFilesUpload,
    handleFilterChange,
    handleKeyboardSelect,
    handleLogout,
    handlePasteClipboard,
    handleSearchChange,
    handleSortChange,
    handleViewModeChange,
    modal,
    openEditor,
    openPreview,
    rememberItem,
    requestModalClose,
    selectedItem,
    selection,
    socket,
    toast,
    ui,
    upload,
  };
}

export type DashboardController = ReturnType<typeof useDashboardController>;
