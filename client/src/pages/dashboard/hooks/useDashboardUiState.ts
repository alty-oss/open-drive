import { useCallback, useState } from "react";
import type { ContextMenuState, ViewMode } from "@/features/explorer";

export interface DashboardClipboard {
  mode: "copy" | "cut";
  paths: string[];
}

export function useDashboardUiState() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = window.localStorage.getItem("open-drive:view-mode");
    return saved === "gallery" ? saved : "list";
  });
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem("open-drive:sidebar-collapsed") === "true",
  );
  const [clipboard, setClipboard] = useState<DashboardClipboard | null>(null);

  const changeViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem("open-drive:view-mode", mode);
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem("open-drive:sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  return {
    viewMode,
    changeViewMode,
    ctxMenu,
    setCtxMenu,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    clipboard,
    setClipboard,
  };
}
