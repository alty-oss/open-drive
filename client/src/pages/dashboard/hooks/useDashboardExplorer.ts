import { useCallback, useEffect } from "react";
import type { FileItem } from "@/shared/files/types";
import {
  useNavigation,
  useWorkspaceTabs,
  type FileFilter,
  type WorkspaceTab,
} from "@/features/explorer";

interface UseDashboardExplorerOptions {
  resetExplorerState: () => void;
  clearExplorerView: () => void;
  openPreview: (file: FileItem) => void;
}

export function useDashboardExplorer({
  resetExplorerState,
  clearExplorerView,
  openPreview,
}: UseDashboardExplorerOptions) {
  const {
    currentPath,
    activeFilter,
    setCurrentPath,
    setActiveFilter,
    pushUrl,
  } = useNavigation({ onNavigateStateChange: resetExplorerState });
  const workspace = useWorkspaceTabs(currentPath, activeFilter);

  const syncLocation = useCallback(
    (path: string, filter: FileFilter, clear = true) => {
      setCurrentPath(path);
      setActiveFilter(filter);
      pushUrl(path, filter);
      if (clear) clearExplorerView();
    },
    [clearExplorerView, pushUrl, setActiveFilter, setCurrentPath],
  );

  useEffect(() => {
    workspace.updateActiveLocation(currentPath, activeFilter, false);
  }, [activeFilter, currentPath, workspace.updateActiveLocation]);

  const setBrowserLocation = useCallback(
    (path: string, filter: FileFilter, clear = true) => {
      workspace.updateActiveLocation(path, filter, clear);
      syncLocation(path, filter, clear);
    },
    [syncLocation, workspace.updateActiveLocation],
  );

  const openLocationInNewTab = useCallback(
    (path: string, filter: FileFilter = null) => {
      workspace.openTab(path, filter);
      syncLocation(path, filter);
    },
    [syncLocation, workspace.openTab],
  );

  const handleActivateTab = useCallback(
    (id: string) => {
      const tab = workspace.activateTab(id);
      if (tab) syncLocation(tab.path, tab.filter);
    },
    [syncLocation, workspace.activateTab],
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      const fallback = workspace.closeTab(id);
      if (fallback) syncLocation(fallback.path, fallback.filter);
    },
    [syncLocation, workspace.closeTab],
  );

  const handleNewTab = useCallback(() => {
    workspace.createTab("", null);
    syncLocation("", null);
  }, [syncLocation, workspace.createTab]);

  const handleNavigate = useCallback(
    (folderPath: string) => setBrowserLocation(folderPath, null),
    [setBrowserLocation],
  );

  const handleOpen = useCallback(
    (file: FileItem) => {
      if (file.isTrash && file.isFolder) return;
      if (file.isFolder) {
        setBrowserLocation(file.path, null);
        return;
      }
      openPreview(file);
    },
    [openPreview, setBrowserLocation],
  );

  const handleOpenItemInNewTab = useCallback(
    (file: FileItem) => {
      if (file.isFolder && !file.isTrash) {
        openLocationInNewTab(file.path, null);
        return;
      }
      if (!file.isFolder) openPreview(file);
    },
    [openLocationInNewTab, openPreview],
  );

  return {
    currentPath,
    activeFilter,
    tabs: workspace.tabs,
    activeTab: workspace.activeTab,
    activeTabId: workspace.activeTabId,
    updateActiveTabView: (
      patch: Partial<
        Pick<WorkspaceTab, "search" | "sortKey" | "sortDir">
      >,
    ) => workspace.updateActiveTab(patch),
    setBrowserLocation,
    handleNavigate,
    handleOpenFolderInNewTab: (folder: FileItem) =>
      !folder.isTrash && openLocationInNewTab(folder.path, null),
    handleOpenPathInNewTab: (path: string) =>
      openLocationInNewTab(path, null),
    handleOpenFilterInNewTab: (filter: FileFilter) =>
      openLocationInNewTab("", filter),
    handleOpenItemInNewTab,
    handleActivateTab,
    handleCloseTab,
    handleNewTab,
    handleOpen,
  };
}
