import { useCallback, useEffect, useState } from "react";
import type {
  SharedLink,
  SharedLinkCounts,
  SharedLinkFilter,
} from "../model/types";
import {
  listAllLinks,
  purgeInactiveLinks,
  purgeItemLink,
  revokeItemLink,
} from "../api/accessApi";

const EMPTY_COUNTS: SharedLinkCounts = {
  all: 0,
  active: 0,
  expired: 0,
  revoked: 0,
};

const SEARCH_DEBOUNCE_MS = 250;

interface UseSharedLinksOptions {
  onToast: (message: string) => void;
}









export function useSharedLinks({ onToast }: UseSharedLinksOptions) {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [counts, setCounts] = useState<SharedLinkCounts>(EMPTY_COUNTS);
  const [status, setStatus] = useState<SharedLinkFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    listAllLinks({ status, search: debouncedSearch }, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setLinks(page.items);
        setCounts(page.counts);
        setNextCursor(page.nextCursor);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error ? caught.message : "Unable to list links",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, debouncedSearch, reloadToken]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listAllLinks({
        status,
        search: debouncedSearch,
        cursor: nextCursor,
      });


      setLinks((current) => {
        const known = new Set(current.map((link) => link.id));
        return [...current, ...page.items.filter((link) => !known.has(link.id))];
      });
      setCounts(page.counts);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to list links",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [debouncedSearch, loadingMore, nextCursor, status]);

  const revoke = useCallback(
    async (link: SharedLink) => {
      setBusyId(link.id);
      try {
        await revokeItemLink(link.id);
        const revokedAt = new Date().toISOString();
        setLinks((current) =>
          status === "active"
            ? current.filter((candidate) => candidate.id !== link.id)
            : current.map((candidate) =>
                candidate.id === link.id
                  ? { ...candidate, status: "revoked" as const, revokedAt }
                  : candidate,
              ),
        );
        setCounts((current) => ({
          ...current,
          active: Math.max(0, current.active - 1),
          revoked: current.revoked + 1,
        }));
        onToast("Link revoked");
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to revoke link",
        );
      } finally {
        setBusyId(null);
      }
    },
    [onToast, status],
  );

  const purge = useCallback(
    async (link: SharedLink) => {
      setBusyId(link.id);
      try {
        await purgeItemLink(link.id);
        setLinks((current) =>
          current.filter((candidate) => candidate.id !== link.id),
        );
        setCounts((current) => ({
          ...current,
          all: Math.max(0, current.all - 1),
          expired:
            link.status === "expired"
              ? Math.max(0, current.expired - 1)
              : current.expired,
          revoked:
            link.status === "revoked"
              ? Math.max(0, current.revoked - 1)
              : current.revoked,
        }));
        onToast("Link deleted from history");
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to delete the link",
        );
      } finally {
        setBusyId(null);
      }
    },
    [onToast],
  );

  const purgeAll = useCallback(async () => {
    setPurging(true);
    try {
      const removed = await purgeInactiveLinks();
      onToast(
        removed === 1
          ? "1 link deleted from history"
          : `${removed} links deleted from history`,
      );
      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to clear link history",
      );
    } finally {
      setPurging(false);
    }
  }, [onToast, refresh]);

  return {
    links,
    counts,
    status,
    setStatus,
    search,
    setSearch,
    loading,
    loadingMore,
    hasMore: Boolean(nextCursor),
    busyId,
    purging,
    inactiveCount: counts.expired + counts.revoked,
    error,
    dismissError: useCallback(() => setError(null), []),
    refresh,
    loadMore,
    revoke,
    purge,
    purgeAll,
  };
}
