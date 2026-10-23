import { useCallback, useEffect, useRef, useState } from "react";
import type { FileItem } from "@/shared/files/types";
import { logClientError } from "@/shared/lib/logger";
import { appendUniqueFiles } from "@/shared/files/pagination";
import { searchExplorer } from "../api/explorerApi";

const SEARCH_DEBOUNCE_MS = 220;

export function useGlobalSearch(search: string) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    nextCursor: string | null;
    total: number;
    loading: boolean;
    error: string | null;
  }>({ nextCursor: null, total: 0, loading: false, error: null });
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const normalizedSearch = search.trim();
  const requestKey = [normalizedSearch, revision].join("\u0000");

  const runSearch = useCallback(
    async (cursor?: string) => {
      if (!normalizedSearch) return;
      const append = !!cursor;
      const requestId = ++requestRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (append) {
        setPagination((current) => ({
          ...current,
          loading: true,
          error: null,
        }));
      } else {
        setLoading(true);
        setError(null);
        setPagination({
          nextCursor: null,
          total: 0,
          loading: false,
          error: null,
        });
      }

      try {
        const page = await searchExplorer(
          normalizedSearch,
          cursor,
          controller.signal,
        );
        if (requestId !== requestRef.current) return;
        setFiles((current) => {
          if (!append) return page.items;
          return appendUniqueFiles(current, page.items);
        });
        setPagination({
          nextCursor: page.nextCursor,
          total: page.total,
          loading: false,
          error: null,
        });
        if (!append) setSettledKey(requestKey);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted || requestId !== requestRef.current) {
          return;
        }
        logClientError(
          append
            ? "files.global_search_page_failed"
            : "files.global_search_failed",
          cause,
          { search: normalizedSearch },
        );
        const message = "Unable to search all files";
        if (append) {
          setPagination((current) => ({
            ...current,
            loading: false,
            error: message,
          }));
        } else {
          setFiles([]);
          setError(message);
          setSettledKey(requestKey);
        }
      } finally {
        if (requestId === requestRef.current) setLoading(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [normalizedSearch, requestKey],
  );

  useEffect(() => {
    if (!normalizedSearch) {
      requestRef.current++;
      abortRef.current?.abort();
      setFiles([]);
      setLoading(false);
      setError(null);
      setSettledKey(null);
      setPagination({
        nextCursor: null,
        total: 0,
        loading: false,
        error: null,
      });
      return;
    }

    requestRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setFiles([]);
    setLoading(true);
    setError(null);
    setPagination({
      nextCursor: null,
      total: 0,
      loading: false,
      error: null,
    });

    const timer = window.setTimeout(() => {
      void runSearch();
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalizedSearch, revision, runSearch]);

  useEffect(
    () => () => {
      requestRef.current++;
      abortRef.current?.abort();
    },
    [],
  );

  return {
    files,
    loading:
      normalizedSearch.length > 0 &&
      (loading || settledKey !== requestKey),
    error,
    active: normalizedSearch.length > 0,
    hasMore: pagination.nextCursor !== null,
    loadingMore: pagination.loading,
    paginationError: pagination.error,
    totalCount: pagination.total,
    loadMore: useCallback(() => {
      if (!pagination.nextCursor || pagination.loading) {
        return Promise.resolve();
      }
      return runSearch(pagination.nextCursor);
    }, [pagination.loading, pagination.nextCursor, runSearch]),
    refresh: useCallback(
      () => setRevision((current) => current + 1),
      [],
    ),
  };
}
