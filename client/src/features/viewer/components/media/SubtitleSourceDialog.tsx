import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  FileUp,
  HardDrive,
  Loader2,
  Search,
  X,
} from "lucide-react";
import type { FileItem } from "@/shared/files/types";
import { isSubtitleFileName } from "../../lib/subtitles";
import { logClientError } from "@/shared/lib/logger";
import { useEscapeKey } from "@/shared/hooks/useEscapeKey";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { appendUniqueFiles } from "@/shared/files/pagination";
import FileIcon from "@/shared/files/FileIcon";
import { cn } from "@/shared/ui/cn";
import { btn, scrollGutter, surface, z } from "@/shared/ui/styles";
import { listViewerFiles } from "../../api/viewerApi";

const sourceOption =
  "grid min-h-20.5 grid-cols-[44px_minmax(0,1fr)_18px] items-center gap-3.25 rounded-md " +
  "border-0 bg-surface-high p-3.25 text-left " +
  "transition-colors duration-150 hover:bg-surface-highest " +
  "[&>svg]:size-4 [&>svg]:text-muted " +
  "[&>span:nth-child(2)]:flex [&>span:nth-child(2)]:min-w-0 [&>span:nth-child(2)]:flex-col " +
  "[&>span:nth-child(2)]:gap-0.75 " +
  "[&_strong]:text-13 [&_strong]:font-semibold [&_strong]:text-text " +
  "[&_small]:text-11 [&_small]:leading-[1.35] [&_small]:text-muted";

const pickerItem =
  "grid min-h-12 w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 " +
  "border-0 bg-transparent px-3.25 py-1.75 text-left text-text " +
  "hover:bg-state-hover focus-visible:bg-state-hover " +
  "[&>svg]:size-3.5 [&>svg]:text-muted " +
  "[&>span:last-child]:text-11 [&>span:last-child]:font-semibold [&>span:last-child]:text-muted";

const pickerState =
  "flex h-full min-h-45 items-center justify-center gap-1.75 p-5 text-11 text-muted text-center";

const crumbButton =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border-0 bg-transparent px-2.5 " +
  "text-11 text-muted hover:bg-state-hover hover:text-text " +
  "aria-[current=page]:bg-state-selected aria-[current=page]:text-on-accent-container [&>svg]:size-3.25";

interface SubtitleSourceDialogProps {
  onClose: () => void;
  onSelectOpenDriveFile: (file: FileItem) => void;
  onTemporaryUpload: () => void;
}

type DialogView = "source" | "files";

export default function SubtitleSourceDialog({
  onClose,
  onSelectOpenDriveFile,
  onTemporaryUpload,
}: SubtitleSourceDialogProps) {
  const [view, setView] = useState<DialogView>("source");
  const [path, setPath] = useState("");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const focusTrap = useFocusTrap<HTMLDivElement>();

  useEscapeKey(onClose);

  const fetchItems = useCallback(async (cursor?: string) => {
    if (view !== "files") return;
    if (cursor) setLoadingMore(true);
    else {
      setLoading(true);
      setNextCursor(null);
    }
    setError("");
    try {
      const page = await listViewerFiles(path, cursor);
      const matching = page.items.filter(
        (item) => item.isFolder || isSubtitleFileName(item.name),
      );
      setItems((current) =>
        cursor ? appendUniqueFiles(current, matching) : matching,
      );
      setNextCursor(page.nextCursor);
    } catch (fetchError) {
      setItems([]);
      setError("Unable to open this folder.");
      logClientError("video.subtitle_files_failed", fetchError, { path });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [path, view]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    setSearch("");
  }, [path]);

  const pathParts = useMemo(() => path.split("/").filter(Boolean), [path]);
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("en-US");
    if (!normalizedSearch) return items;
    return items.filter((item) =>
      item.name.toLocaleLowerCase("en-US").includes(normalizedSearch),
    );
  }, [items, search]);

  const chooseTemporaryUpload = () => {
    onTemporaryUpload();
    onClose();
  };

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center bg-[rgba(20,20,33,0.32)] p-4.5 backdrop-blur-[3px]", z.subtitleDialog)}>
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-transparent"
        aria-label="Close subtitle selector"
        onClick={onClose}
      />
      <div
        ref={focusTrap.ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subtitle-dialog-title"
        tabIndex={-1}
        className={cn(surface.card, "max-h-[min(680px,90vh)] w-[min(620px,94vw)] overflow-hidden")}
        onKeyDown={(event) => {
          focusTrap.onKeyDown(event);
          event.stopPropagation();
        }}
      >
        <div className="flex min-h-17 items-start justify-between gap-4.5 border-b border-border-subtle px-4.25 py-3.75">
          <div>
            <h2 id="subtitle-dialog-title" className="text-sm font-semibold text-text">
              {view === "source" ? "Add subtitle" : "Choose from OpenDrive"}
            </h2>
            <p className="mt-0.75 text-11 text-muted">
              {view === "source"
                ? "Select where the subtitle should be loaded from."
                : "Browse folders and choose an SRT or VTT file."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(btn.icon, "[&>svg]:size-4")}
            aria-label="Close subtitle selector"
          >
            <X />
          </button>
        </div>

        {view === "source" ? (
          <div className="grid gap-2.5 p-4.5">
            <button
              type="button"
              className={sourceOption}
              onClick={() => setView("files")}
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-on-accent-container [&>svg]:size-5">
                <HardDrive />
              </span>
              <span>
                <strong>OpenDrive file</strong>
                <small>Choose a subtitle already stored in your drive.</small>
              </span>
              <ChevronRight />
            </button>

            <button
              type="button"
              className={sourceOption}
              onClick={chooseTemporaryUpload}
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-on-accent-container [&>svg]:size-5">
                <FileUp />
              </span>
              <span>
                <strong>Temporary upload</strong>
                <small>
                  Use a local file only during this preview.
                </small>
              </span>
              <ChevronRight />
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2.5 border-b border-border-subtle bg-surface px-2.75 py-2.25">
              <div className={cn("flex h-8.5 min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden [&>button]:shrink-0 [&>span]:inline-flex [&>span]:shrink-0 [&>span]:items-center [&>span>svg]:mx-px [&>span>svg]:size-3 [&>span>svg]:shrink-0 [&>span>svg]:text-muted", scrollGutter)}>
                <button
                  type="button"
                  className={crumbButton}
                  onClick={() => setPath("")}
                  aria-current={path === "" ? "page" : undefined}
                >
                  <HardDrive />
                  My Drive
                </button>
                {pathParts.map((part, index) => {
                  const nextPath = pathParts.slice(0, index + 1).join("/");
                  return (
                    <span key={nextPath}>
                      <ChevronRight />
                      <button
                        type="button"
                        className={crumbButton}
                        onClick={() => setPath(nextPath)}
                        aria-current={nextPath === path ? "page" : undefined}
                      >
                        {part}
                      </button>
                    </span>
                  );
                })}
              </div>

              <label className="flex h-10 w-47.5 shrink-0 items-center gap-2 rounded-full border border-border-subtle bg-surface-high px-3 focus-within:bg-surface-highest focus-within:shadow-e1 [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-muted [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-none [&>input]:border-0 [&>input]:bg-transparent [&>input]:p-0 [&>input]:text-11 [&>input]:shadow-none [&>input:focus]:shadow-none">
                <Search />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search this folder"
                  aria-label="Search subtitles in this folder"
                />
              </label>
            </div>

            <div className={cn("h-85 overflow-y-auto bg-surface", scrollGutter)}>
              {loading ? (
                <div className={pickerState}>
                  <Loader2 className="animate-spin" />
                  Loading...
                </div>
              ) : error ? (
                <div className={cn(pickerState, "flex-col text-danger")}>
                  {error}
                  <button type="button" onClick={() => void fetchItems()}>
                    Try again
                  </button>
                </div>
              ) : visibleItems.length === 0 && !nextCursor ? (
                <div className={pickerState}>
                  No SRT/VTT subtitle or folder was found here.
                </div>
              ) : (
                <>
                  {visibleItems.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      className={pickerItem}
                      onClick={() => {
                        if (item.isFolder) {
                          setPath(item.path);
                        } else {
                          onSelectOpenDriveFile(item);
                        }
                      }}
                    >
                      <FileIcon
                        name={item.name}
                        isFolder={item.isFolder}
                        size="sm"
                      />
                      <span className="min-w-0 overflow-hidden text-xs font-medium text-ellipsis whitespace-nowrap">
                        {item.name}
                      </span>
                      {item.isFolder ? <ChevronRight /> : <span>SRT/VTT</span>}
                    </button>
                  ))}
                  {nextCursor ? (
                    <button
                      type="button"
                      className={cn(pickerItem, "justify-center font-semibold text-accent-strong")}
                      disabled={loadingMore}
                      onClick={() => void fetchItems(nextCursor)}
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex justify-between gap-2 border-t border-border-subtle p-2.75">
              <button
                type="button"
                className={cn(btn.outlined, "h-9 px-3 text-sm")}
                onClick={() => setView("source")}
              >
                Back
              </button>
              <button
                type="button"
                className={cn(btn.primary, "h-9 px-3 text-sm [&>svg]:size-4")}
                onClick={chooseTemporaryUpload}
              >
                <FileUp />
                Temporary upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
