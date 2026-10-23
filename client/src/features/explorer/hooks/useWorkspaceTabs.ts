import { useCallback, useRef, useState } from "react";
import type {
  FileFilter,
  SortDir,
  SortKey,
  WorkspaceTab,
} from "../model/types";

const MAX_OPEN_TABS = 20;

export function tabName(path: string, filter: FileFilter) {
  if (filter === "trash") return "Trash";
  if (filter === "links") return "Links";
  if (!path) return "My Drive";
  return path.split("/").filter(Boolean).at(-1) ?? "My Drive";
}

function defaultSort(filter: FileFilter): {
  sortKey: SortKey;
  sortDir: SortDir;
} {
  const newestFirst = filter === "trash";
  return {
    sortKey: newestFirst ? "date" : "name",
    sortDir: newestFirst ? "desc" : "asc",
  };
}

function createTab(
  id: string,
  path: string,
  filter: FileFilter,
): WorkspaceTab {
  return {
    id,
    name: tabName(path, filter),
    path,
    filter,
    search: "",
    ...defaultSort(filter),
  };
}

function sameLocation(tab: WorkspaceTab, path: string, filter: FileFilter) {
  return tab.path === path && tab.filter === filter;
}

export function useWorkspaceTabs(
  initialPath: string,
  initialFilter: FileFilter,
) {
  const [initialTab] = useState(() =>
    createTab("explorer-tab-1", initialPath, initialFilter),
  );
  const nextId = useRef(2);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([initialTab]);
  const [activeTabId, setActiveTabId] = useState(initialTab.id);
  const activeTab =
    tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  const updateActiveTab = useCallback(
    (patch: Partial<Omit<WorkspaceTab, "id">>) => {
      setTabs((current) =>
        current.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                ...patch,
                name: tabName(
                  patch.path ?? tab.path,
                  patch.filter === undefined ? tab.filter : patch.filter,
                ),
              }
            : tab,
        ),
      );
    },
    [activeTabId],
  );

  const updateActiveLocation = useCallback(
    (path: string, filter: FileFilter, clearView = true) => {
      updateActiveTab({
        path,
        filter,
        ...(clearView
          ? {
              search: "",
              ...defaultSort(filter),
            }
          : {}),
      });
    },
    [updateActiveTab],
  );

  const openTab = useCallback(
    (path: string, filter: FileFilter) => {
      const existing = tabs.find((tab) => sameLocation(tab, path, filter));
      if (existing) {
        setActiveTabId(existing.id);
        return existing;
      }

      const tab = createTab(`explorer-tab-${nextId.current++}`, path, filter);
      setTabs((current) => [...current, tab].slice(-MAX_OPEN_TABS));
      setActiveTabId(tab.id);
      return tab;
    },
    [tabs],
  );

  const createNewTab = useCallback((path: string, filter: FileFilter) => {
    const tab = createTab(`explorer-tab-${nextId.current++}`, path, filter);
    setTabs((current) => [...current, tab].slice(-MAX_OPEN_TABS));
    setActiveTabId(tab.id);
    return tab;
  }, []);

  const activateTab = useCallback(
    (id: string) => {
      const tab = tabs.find((candidate) => candidate.id === id) ?? null;
      if (tab) setActiveTabId(id);
      return tab;
    },
    [tabs],
  );

  const closeTab = useCallback(
    (id: string) => {
      const index = tabs.findIndex((tab) => tab.id === id);
      if (index === -1) return null;

      if (tabs.length === 1) {
        const rootTab = createTab(tabs[0].id, "", null);
        setTabs([rootTab]);
        setActiveTabId(rootTab.id);
        return rootTab;
      }

      const remaining = tabs.filter((tab) => tab.id !== id);
      const fallback = remaining[Math.max(0, index - 1)] ?? remaining[0];
      setTabs(remaining);
      if (activeTabId === id) setActiveTabId(fallback.id);
      return activeTabId === id ? fallback : null;
    },
    [activeTabId, tabs],
  );

  return {
    tabs,
    activeTab,
    activeTabId,
    updateActiveTab,
    updateActiveLocation,
    openTab,
    createTab: createNewTab,
    activateTab,
    closeTab,
  };
}
