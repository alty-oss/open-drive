import { AlertCircle, LoaderCircle, RotateCcw } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { btn, spinner } from "@/shared/ui/styles";

export function GlobalSearchLoading({ query }: { query: string }) {
  return (
    <div
      className="flex min-h-70 flex-1 items-center justify-center gap-3.25 p-8 text-left text-muted"
      role="status"
      aria-live="polite"
      aria-label={`Searching for ${query}`}
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-6.25 flex-none animate-spin text-accent motion-reduce:animate-none"
      />
      <div className="grid min-w-0 gap-0.75">
        <strong className="text-sm text-text">
          Searching all files
        </strong>
        <span className="max-w-[min(420px,70vw)] overflow-hidden text-xs text-ellipsis whitespace-nowrap">
          Searching for “{query}”
        </span>
      </div>
    </div>
  );
}

export function PaginationFooter({
  loaded,
  total,
  hasMore,
  loading,
  error,
  onLoadMore,
}: {
  loaded: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  onLoadMore: () => void | Promise<void>;
}) {
  if (!hasMore && !loading && !error) return null;

  return (
    <div
      className="flex min-h-14.5 flex-none flex-wrap items-center justify-center gap-x-2.5 gap-y-1.75 bg-surface px-4 py-2.5 text-11 text-muted sm:flex-nowrap sm:gap-3"
      aria-live="polite"
    >
      <span>
        Showing {loaded} of {Math.max(total, loaded)}
      </span>
      {error ? (
        <span className="w-full text-center text-danger sm:w-auto">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        className={cn(btn.tonal, "h-9 px-3 text-xs font-semibold")}
        disabled={loading}
        onClick={() => void onLoadMore()}
      >
        {loading ? (
          <>
            <span className={spinner} aria-hidden="true" />
            Loading…
          </>
        ) : error ? (
          "Try again"
        ) : (
          "Load more"
        )}
      </button>
    </div>
  );
}

export function FileBrowserError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex min-h-70 flex-1 flex-col items-center justify-center gap-3 bg-surface p-8 text-center text-muted"
      role="alert"
    >
      <span
        className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger [&>svg]:size-5.25"
        aria-hidden="true"
      >
        <AlertCircle />
      </span>
      <div>
        <h2 className="text-sm font-medium text-text">
          Unable to load files
        </h2>
        <p className="mt-0.75 max-w-110 text-xs">{message}</p>
      </div>
      <button
        type="button"
        className={cn(btn.tonal, "mt-1 h-8.5 px-3 text-xs [&>svg]:size-3.5")}
        onClick={onRetry}
      >
        <RotateCcw />
        Try again
      </button>
    </div>
  );
}
