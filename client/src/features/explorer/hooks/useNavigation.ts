import { useCallback, useEffect, useState } from "react";
import type { FileFilter } from "../model/types";

const VALID_FILTERS: Exclude<FileFilter, null>[] = [
  "trash",
  "links",
];




const APP_URL = "/";

interface HistoryLocation {
  path: string;
  filter: FileFilter;
}

function readHistoryLocation(state: unknown): HistoryLocation {
  const candidate = (state ?? {}) as Partial<HistoryLocation>;
  const filter = VALID_FILTERS.includes(candidate.filter as Exclude<FileFilter, null>)
    ? (candidate.filter as FileFilter)
    : null;
  return {
    path: filter || typeof candidate.path !== "string" ? "" : candidate.path,
    filter,
  };
}

interface UseNavigationOptions {
  onNavigateStateChange?: () => void;
}

export function useNavigation({
  onNavigateStateChange,
}: UseNavigationOptions = {}) {

  const [currentPath, setCurrentPath] = useState("");
  const [activeFilter, setActiveFilter] = useState<FileFilter>(null);

  const pushUrl = useCallback((path: string, filter: FileFilter) => {
    const current = readHistoryLocation(window.history.state);
    if (current.path === path && current.filter === filter) return;
    window.history.pushState({ path, filter }, "", APP_URL);
  }, []);

  useEffect(() => {
    const handler = (event: PopStateEvent) => {
      const { path, filter } = readHistoryLocation(event.state);
      setCurrentPath(path);
      setActiveFilter(filter);
      onNavigateStateChange?.();
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [onNavigateStateChange]);

  useEffect(() => {
    window.history.replaceState({ path: "", filter: null }, "", APP_URL);
  }, []);

  const navigateToPath = useCallback(
    (path: string) => {
      setCurrentPath(path);
      setActiveFilter(null);
      onNavigateStateChange?.();
      pushUrl(path, null);
    },
    [onNavigateStateChange, pushUrl],
  );

  const navigateToFilter = useCallback(
    (filter: FileFilter) => {
      setActiveFilter(filter);
      if (filter) setCurrentPath("");
      onNavigateStateChange?.();
      pushUrl("", filter);
    },
    [onNavigateStateChange, pushUrl],
  );

  return {
    currentPath,
    activeFilter,
    setCurrentPath,
    setActiveFilter,
    pushUrl,
    navigateToPath,
    navigateToFilter,
  };
}
