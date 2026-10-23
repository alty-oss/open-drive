import type { ReactNode } from "react";
import { Grid2X2, List, SlidersHorizontal } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import type { SortDir, SortKey } from "../../model/types";
import { SORT_OPTIONS } from "./explorerHeaderUi";
import type { ExplorerViewState } from "./types";

export default function ExplorerViewControls({
  viewMode,
  sortKey,
  sortDir,
  onViewModeChange,
  onSortChange,
}: ExplorerViewState) {
  return (
    <>
      <label className="hidden h-10 items-center gap-2 rounded-full bg-surface-alt px-4 text-muted lg:flex [&>svg]:size-4">
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
          className="h-full w-28 rounded-none border-0 bg-transparent p-0 text-xs text-muted-strong shadow-none focus:shadow-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div
        className="hidden h-10 items-center rounded-full bg-surface-alt p-1 lg:inline-flex"
        aria-label="View mode"
      >
        <ViewButton
          active={viewMode === "list"}
          ariaLabel="List view"
          onClick={() => onViewModeChange("list")}
        >
          <List />
        </ViewButton>
        <ViewButton
          active={viewMode === "gallery"}
          ariaLabel="Gallery view"
          onClick={() => onViewModeChange("gallery")}
        >
          <Grid2X2 />
        </ViewButton>
      </div>
    </>
  );
}

function ViewButton({
  active,
  children,
  onClick,
  ariaLabel,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      data-tooltip={ariaLabel}
      onClick={onClick}
      className={cn(

        "tooltip-anchor relative inline-flex size-8 cursor-pointer items-center justify-center",
        "rounded-full border-0 bg-transparent text-muted [&>svg]:size-4",
        "transition-colors duration-150 hover:bg-state-hover hover:text-text",
        active &&
          "bg-accent-soft text-on-accent-container shadow-e1 hover:bg-accent-soft",
      )}
    >
      {children}
    </button>
  );
}
