import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FileItem } from "@/shared/files/types";
import type { StorageStats } from "@/shared/files/storageTypes";
import type { FileFilter } from "../model/types";
import { logClientError } from "@/shared/lib/logger";
import { appendUniqueFiles } from "@/shared/files/pagination";
import {
  EXPLORER_MAX_PAGE_SIZE,
  EXPLORER_PAGE_SIZE,
  fetchExplorerPage,
  fetchStorageStats,
} from "../api/explorerApi";

interface UseFilesOptions {
  currentPath: string;
  activeFilter: FileFilter;
}

interface CachedListing {
  items: FileItem[];
  nextCursor: string | null;
  total: number;
  fetchedAt: number;
}


const MAX_CACHED_LISTINGS = 40;

const PREFETCH_FRESH_MS = 15_000;







function filterListingUrl(filter: string) {
  if (filter === "links") return null;
  if (filter === "trash") return "/api/trash";
  return null;
}

function pathListingUrl(path: string) {
  return `/api/files${path ? `?path=${encodeURIComponent(path)}` : ""}`;
}








export function useFiles({ currentPath, activeFilter }: UseFilesOptions) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [listingState, setListingState] = useState<{
    key: string | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
  }>({ key: null, loading: true, refreshing: false, error: null });
  const [pagination, setPagination] = useState<{
    key: string | null;
    nextCursor: string | null;
    total: number;
    loading: boolean;
    error: string | null;
  }>({
    key: null,
    nextCursor: null,
    total: 0,
    loading: false,
    error: null,
  });
  const listingRequestRef = useRef(0);
  const listingAbortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, CachedListing>());
  const prefetchingRef = useRef(new Map<string, AbortController>());

  const displayedKeyRef = useRef<string | null>(null);
  const listingKey = activeFilter
    ? `filter:${activeFilter}`
    : `path:${currentPath}`;

  const remember = useCallback((key: string, listing: CachedListing) => {
    const cache = cacheRef.current;
    cache.delete(key);
    cache.set(key, listing);
    while (cache.size > MAX_CACHED_LISTINGS) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }, []);

  const runListingRequest = useCallback(
    async (
      key: string,
      url: string,
      event: string,
      context: Record<string, unknown>,
      cursor?: string,
    ) => {
      const append = !!cursor;
      const requestId = ++listingRequestRef.current;
      listingAbortRef.current?.abort();
      const controller = new AbortController();
      listingAbortRef.current = controller;
      const cached = cacheRef.current.get(key);
      const showingKey = displayedKeyRef.current === key;
      let pageSize = EXPLORER_PAGE_SIZE;

      if (append) {
        setPagination((current) => ({
          ...current,
          loading: true,
          error: null,
        }));
      } else if (showingKey || cached) {

        if (!showingKey && cached) {
          displayedKeyRef.current = key;
          setFiles(cached.items);
          setPagination({
            key,
            nextCursor: cached.nextCursor,
            total: cached.total,
            loading: false,
            error: null,
          });
        }


        const loaded = cached?.items.length ?? 0;
        pageSize = Math.min(
          EXPLORER_MAX_PAGE_SIZE,
          Math.max(EXPLORER_PAGE_SIZE, loaded),
        );
        setListingState({ key, loading: false, refreshing: true, error: null });
      } else {
        setListingState({ key, loading: true, refreshing: false, error: null });
        setPagination({
          key,
          nextCursor: null,
          total: 0,
          loading: false,
          error: null,
        });
      }

      try {
        const page = await fetchExplorerPage(
          url,
          cursor,
          controller.signal,
          pageSize,
        );
        if (requestId !== listingRequestRef.current) return;
        const previous = cacheRef.current.get(key);
        const items =
          append && previous
            ? appendUniqueFiles(previous.items, page.items)
            : page.items;
        remember(key, {
          items,
          nextCursor: page.nextCursor,
          total: page.total,
          fetchedAt: Date.now(),
        });
        displayedKeyRef.current = key;
        setFiles((current) =>
          append ? appendUniqueFiles(current, page.items) : page.items,
        );
        if (key === "filter:trash") setTrashCount(page.total);
        setListingState({
          key,
          loading: false,
          refreshing: false,
          error: null,
        });
        setPagination({
          key,
          nextCursor: page.nextCursor,
          total: page.total,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted || requestId !== listingRequestRef.current) {
          return;
        }
        logClientError(event, error, context);
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load os files";
        if (append) {
          setPagination((current) => ({
            ...current,
            loading: false,
            error: message,
          }));
        } else if (displayedKeyRef.current === key) {

          setListingState({
            key,
            loading: false,
            refreshing: false,
            error: null,
          });
        } else {
          setListingState({
            key,
            loading: false,
            refreshing: false,
            error: message,
          });
        }
      } finally {
        if (listingAbortRef.current === controller) {
          listingAbortRef.current = null;
        }
      }
    },
    [remember],
  );

  const fetchFiles = useCallback(() => {
    return runListingRequest(
      `path:${currentPath}`,
      pathListingUrl(currentPath),
      "files.list_failed",
      { currentPath },
    );
  }, [currentPath, runListingRequest]);

  const fetchFilteredFiles = useCallback(
    (filter: string) => {
      const url = filterListingUrl(filter);
      if (!url) return Promise.resolve();
      return runListingRequest(`filter:${filter}`, url, "files.filter_failed", {
        filter,
      });
    },
    [runListingRequest],
  );

  const fetchStats = useCallback(async () => {
    try {
      const nextStats = await fetchStorageStats();
      setStats(nextStats);
      setTotalSize(nextStats.used);
      setTrashCount(nextStats.trashCount);
    } catch (error) {
      logClientError("storage.stats_failed", error);
    }
  }, []);

  const refreshFiles = useCallback(() => {
    if (activeFilter) return fetchFilteredFiles(activeFilter);
    return fetchFiles();
  }, [activeFilter, fetchFilteredFiles, fetchFiles]);

  const loadMore = useCallback(() => {
    if (
      pagination.key !== listingKey ||
      !pagination.nextCursor ||
      pagination.loading
    ) {
      return Promise.resolve();
    }
    const cursor = pagination.nextCursor;
    if (activeFilter) {
      const url = filterListingUrl(activeFilter);
      if (!url) return Promise.resolve();
      return runListingRequest(
        `filter:${activeFilter}`,
        url,
        "files.filter_page_failed",
        { filter: activeFilter },
        cursor,
      );
    }
    return runListingRequest(
      `path:${currentPath}`,
      pathListingUrl(currentPath),
      "files.list_page_failed",
      { currentPath },
      cursor,
    );
  }, [
    activeFilter,
    currentPath,
    listingKey,
    pagination.key,
    pagination.loading,
    pagination.nextCursor,
    runListingRequest,
  ]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshFiles(), fetchStats()]);
  }, [refreshFiles, fetchStats]);





  const removeItems = useCallback(
    (paths: Iterable<string>) => {
      const removed = new Set(paths);
      if (removed.size === 0) return;
      const key = displayedKeyRef.current;
      const cached = key ? cacheRef.current.get(key) : undefined;
      if (!key || !cached) return;

      const items = cached.items.filter((item) => !removed.has(item.path));
      const removedCount = cached.items.length - items.length;
      if (removedCount === 0) return;
      cacheRef.current.set(key, {
        ...cached,
        items,
        total: Math.max(0, cached.total - removedCount),
      });
      setFiles((current) =>
        current.filter((item) => !removed.has(item.path)),
      );
      setPagination((current) =>
        current.key === key
          ? { ...current, total: Math.max(0, current.total - removedCount) }
          : current,
      );
    },
    [],
  );


  const prefetchPath = useCallback(
    (path: string) => {
      const key = `path:${path}`;
      const cached = cacheRef.current.get(key);
      if (cached && Date.now() - cached.fetchedAt < PREFETCH_FRESH_MS) return;
      if (prefetchingRef.current.has(key)) return;
      if (displayedKeyRef.current === key) return;
      const controller = new AbortController();
      prefetchingRef.current.set(key, controller);
      fetchExplorerPage(pathListingUrl(path), undefined, controller.signal)
        .then((page) => {

          const current = cacheRef.current.get(key);
          if (current && current.fetchedAt > (cached?.fetchedAt ?? 0)) return;
          remember(key, {
            items: page.items,
            nextCursor: page.nextCursor,
            total: page.total,
            fetchedAt: Date.now(),
          });
        })
        .catch(() => {})
        .finally(() => {
          if (prefetchingRef.current.get(key) === controller) {
            prefetchingRef.current.delete(key);
          }
        });
    },
    [remember],
  );



  useLayoutEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(
    () => () => {
      listingRequestRef.current++;
      listingAbortRef.current?.abort();
      for (const controller of prefetchingRef.current.values()) {
        controller.abort();
      }
      prefetchingRef.current.clear();
    },
    [],
  );




  const pendingCached =
    listingState.key !== listingKey
      ? cacheRef.current.get(listingKey)
      : undefined;
  const filesLoading =
    !pendingCached &&
    (listingState.key !== listingKey || listingState.loading);
  const filesError =
    listingState.key === listingKey ? listingState.error : null;

  return {
    files: pendingCached ? pendingCached.items : files,
    filesLoading,
    filesRefreshing:
      !!pendingCached ||
      (listingState.key === listingKey && listingState.refreshing),
    filesError,
    hasMore: pendingCached
      ? pendingCached.nextCursor !== null
      : pagination.key === listingKey && pagination.nextCursor !== null,
    loadingMore:
      pagination.key === listingKey && pagination.loading,
    paginationError:
      pagination.key === listingKey ? pagination.error : null,
    totalCount: pendingCached
      ? pendingCached.total
      : pagination.key === listingKey
        ? pagination.total
        : files.length,
    stats,
    totalSize,
    trashCount,
    fetchFiles,
    fetchFilteredFiles,
    fetchStats,
    refreshFiles,
    refreshAll,
    loadMore,
    removeItems,
    prefetchPath,
  };
}
