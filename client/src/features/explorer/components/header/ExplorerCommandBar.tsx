import {
  Clipboard,
  Download,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import ExplorerCreateMenu from "./ExplorerCreateMenu";
import ExplorerSelectionActions from "./ExplorerSelectionActions";
import ExplorerViewControls from "./ExplorerViewControls";
import ToolbarButton from "./ToolbarButton";
import type {
  ExplorerCreateActions,
  ExplorerSelectionActions as SelectionActionsProps,
  ExplorerViewState,
} from "./types";
import type { FileFilter } from "../../model/types";

interface ExplorerCommandBarProps
  extends ExplorerCreateActions,
    SelectionActionsProps,
    ExplorerViewState {
  activeFilter: FileFilter;
  mobileOptionsOpen: boolean;
  onOpenMobileOptions: () => void;
}

export default function ExplorerCommandBar({
  activeFilter,
  mobileOptionsOpen,
  onOpenMobileOptions,
  canPaste,
  onUpload,
  onNewFolder,
  onNewFile,
  onPaste,
  onDownloadAll,
  onEmptyTrash,
  ...rest
}: ExplorerCommandBarProps) {
  const selectionActive = rest.selectedCount > 0;

  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 px-2.5 py-1.5 md:px-4",
        selectionActive
          ? "justify-between max-md:min-h-13.5 max-md:gap-0 max-md:py-1.25 max-md:pr-0 max-md:pl-2"
          : "justify-end md:justify-between",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1 [scrollbar-width:none]",
          selectionActive
            ?
              "overflow-visible max-md:gap-0 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:overscroll-x-contain max-md:pr-2 max-md:[scroll-padding-left:42px] max-md:[scroll-snap-type:x_proximity]"
            : "hidden overflow-x-auto md:flex",
        )}
      >
        {selectionActive ? (
          <>
            <div
              className="flex h-9 flex-none items-center gap-2 pr-2 text-13 font-semibold text-muted-strong max-md:sticky max-md:left-0 max-md:z-3 max-md:h-10.5 max-md:bg-surface max-md:pr-2.25 max-md:shadow-[8px_0_12px_var(--surface)]"
              aria-label={`${rest.selectedCount} ${
                rest.selectedCount === 1
                  ? "selected item"
                  : "selected items"
              }`}
            >
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-on-accent-container max-md:h-7.5 max-md:min-w-7.5 max-md:text-13">
                {rest.selectedCount}
              </span>
              <span aria-hidden="true" className="max-md:hidden">
                {rest.selectedCount === 1
                  ? "selected item"
                  : "selected items"}
              </span>
            </div>
            <ExplorerSelectionActions activeFilter={activeFilter} {...rest} />
          </>
        ) : (
          <>
            <ExplorerCreateMenu
              onNewFolder={onNewFolder}
              onNewFile={onNewFile}
            />
            <ToolbarButton label="Upload" onClick={onUpload}>
              <Upload />
            </ToolbarButton>


            {canPaste ? (
              <ToolbarButton label="Paste" onClick={onPaste}>
                <Clipboard />
              </ToolbarButton>
            ) : null}
            <ToolbarButton label="Download visible items" onClick={onDownloadAll}>
              <Download />
            </ToolbarButton>
            {activeFilter === "trash" ? (
              <ToolbarButton label="Empty trash" onClick={onEmptyTrash} danger>
                <Trash2 />
              </ToolbarButton>
            ) : null}
          </>
        )}
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-none items-center gap-1",
          selectionActive && "max-md:hidden",
        )}
      >
        <button
          type="button"
          className={cn(
            btn.icon,
            "lg:hidden",

            "max-md:h-10 max-md:w-auto max-md:min-w-23 max-md:gap-2 max-md:rounded-full max-md:bg-surface-alt max-md:px-4",
          )}
          aria-label="Open options"
          aria-haspopup="dialog"
          aria-expanded={mobileOptionsOpen}
          onClick={onOpenMobileOptions}
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden text-xs font-semibold max-md:inline">
            Options
          </span>
        </button>
        <ExplorerViewControls {...rest} />
      </div>
    </div>
  );
}
