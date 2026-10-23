import { createPortal } from "react-dom";
import {
  Clipboard,
  Download,
  FilePlus2,
  FolderPlus,
  Grid2X2,
  List,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { btn, z } from "@/shared/ui/styles";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { useEscapeKey } from "@/shared/hooks/useEscapeKey";
import type {
  FileFilter,
  SortDir,
  SortKey,
  ViewMode,
} from "../../model/types";
import { SORT_OPTIONS } from "./explorerHeaderUi";
import type { ExplorerCreateActions, ExplorerViewState } from "./types";

const sectionLabel =
  "text-11 font-medium tracking-[0.08em] text-muted uppercase";

const quickAction =
  "flex min-h-14 min-w-0 items-center gap-3 rounded-md border-0 " +
  "bg-surface-high px-3 py-2 text-left text-muted-strong " +
  "active:bg-accent-soft " +
  "[&>svg]:size-4.5 [&>svg]:flex-none [&>svg]:text-accent " +
  "[&>span]:overflow-hidden [&>span]:text-13 [&>span]:font-medium " +
  "[&>span]:text-ellipsis [&>span]:whitespace-nowrap";

const secondaryAction =
  "flex min-h-12 items-center gap-3 rounded-full border-0 bg-surface-high " +
  "px-4 text-left text-13 font-medium text-muted-strong " +
  "[&>svg]:size-[17px] [&>svg]:flex-none [&>svg]:text-accent";

const viewOption =
  "flex h-12 items-center justify-center gap-2 rounded-full border-0 " +
  "bg-surface-high text-muted-strong [&>svg]:size-4 " +
  "disabled:bg-surface-alt disabled:text-muted disabled:opacity-38";

interface MobileOptionsSheetProps
  extends ExplorerViewState,
    ExplorerCreateActions {
  activeFilter: FileFilter;
  onClose: () => void;
}

export default function MobileOptionsSheet({
  activeFilter,
  viewMode,
  sortKey,
  sortDir,
  canPaste,
  onClose,
  onViewModeChange,
  onSortChange,
  onNewFolder,
  onNewFile,
  onUpload,
  onPaste,
  onDownloadAll,
  onEmptyTrash,
}: MobileOptionsSheetProps) {
  const focusTrap = useFocusTrap<HTMLElement>();
  useEscapeKey(onClose);

  const runAction = (action: () => void) => {
    onClose();
    action();
  };

  const viewButton = (mode: ViewMode) =>
    cn(
      viewOption,
      viewMode === mode && "bg-accent-soft text-on-accent-container",
    );

  return createPortal(
    <div
      className={cn(
        "animate-fade-in fixed inset-0 flex items-end justify-center bg-black/40 px-0 pt-4 sm:px-4",
        z.overlayTop,
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default border-0 bg-transparent"
        aria-label="Close options"
        onClick={onClose}
      />
      <section
        ref={focusTrap.ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-options-title"
        tabIndex={-1}
        className="animate-sheet-in relative z-1 max-h-[min(82dvh,720px)] w-full overflow-hidden rounded-t-xl border-0 bg-surface-alt text-text shadow-e4 outline-none sm:w-[min(620px,100%)]"
        onKeyDown={focusTrap.onKeyDown}
      >
        <div
          className="mx-auto mt-3 mb-1 h-1 w-8 rounded-full bg-surface-highest"
          aria-hidden="true"
        />
        <div className="flex min-h-14.5 items-center justify-between gap-4 border-b border-border-subtle px-4 pt-2 pb-2.5">
          <div>
            <span className={sectionLabel}>Tools and view</span>
            <h2 id="mobile-options-title" className="mt-0.5 text-base font-medium">
              Explorer options
            </h2>
          </div>
          <button
            type="button"
            className={btn.icon}
            aria-label="Close options"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[calc(min(82dvh,720px)-72px)] overflow-y-auto px-4 pt-1 pb-5.5">
          <section className="pt-4">
            <h3 className={cn(sectionLabel, "mb-2 block")}>Quick actions</h3>
            <div className="grid grid-cols-2 gap-2 [&>button:last-child:nth-child(odd)]:col-span-2">
              <button
                type="button"
                className={quickAction}
                onClick={() => runAction(onNewFolder)}
              >
                <FolderPlus />
                <span>New folder</span>
              </button>
              <button
                type="button"
                className={quickAction}
                onClick={() => runAction(onNewFile)}
              >
                <FilePlus2 />
                <span>New file</span>
              </button>
              <button
                type="button"
                className={quickAction}
                onClick={() => runAction(onUpload)}
              >
                <Upload />
                <span>Upload files</span>
              </button>
              {canPaste ? (
                <button
                  type="button"
                  className={quickAction}
                  onClick={() => runAction(onPaste)}
                >
                  <Clipboard />
                  <span>Paste</span>
                </button>
              ) : null}
            </div>
          </section>

          <section className="pt-4">
            <h3 className={cn(sectionLabel, "mb-2 block")}>Sort</h3>
            <label className="flex h-12 items-center gap-3 rounded-full border-0 bg-surface-high px-4 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted">
              <SlidersHorizontal />
              <select
                value={`${sortKey}:${sortDir}`}
                onChange={(event) => {
                  const [key, dir] = event.target.value.split(":") as [
                    SortKey,
                    SortDir,
                  ];
                  onSortChange(key, dir);
                }}
                aria-label="Sort files"
                className="h-full w-full rounded-none border-0 bg-transparent shadow-none focus:shadow-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="pt-4">
            <h3 className={cn(sectionLabel, "mb-2 block")}>View</h3>
            <div className="grid grid-cols-2 gap-1.75">
              <button
                type="button"
                className={viewButton("list")}
                aria-pressed={viewMode === "list"}
                onClick={() => onViewModeChange("list")}
              >
                <List />
                Lista
              </button>
              <button
                type="button"
                className={viewButton("gallery")}
                aria-pressed={viewMode === "gallery"}
                onClick={() => onViewModeChange("gallery")}
              >
                <Grid2X2 />
                Galeria
              </button>
            </div>
          </section>

          <section className="pt-4">
            <h3 className={cn(sectionLabel, "mb-2 block")}>More actions</h3>
            <div className="grid gap-1.75">
              <button
                type="button"
                className={secondaryAction}
                onClick={() => runAction(onDownloadAll)}
              >
                <Download />
                <span>Download visible items</span>
              </button>
              {activeFilter === "trash" ? (
                <button
                  type="button"
                  className={cn(
                    secondaryAction,
                    "border-border-danger bg-danger-soft text-danger [&>svg]:text-danger",
                  )}
                  onClick={() => runAction(onEmptyTrash)}
                >
                  <Trash2 />
                  <span>Empty trash</span>
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
}
