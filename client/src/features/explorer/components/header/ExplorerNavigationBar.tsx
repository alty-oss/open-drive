import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Menu, Search, X } from "lucide-react";
import Breadcrumb from "../Breadcrumb";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import ExplorerSearchField from "./ExplorerSearchField";
import { FILTER_ICONS } from "./explorerHeaderUi";
import type { ExplorerLocation, ExplorerSearch } from "./types";

interface ExplorerNavigationBarProps extends ExplorerLocation, ExplorerSearch {
  locationLabel: string;
  onOpenSidebar: () => void;
  mobileSearchOpen: boolean;
  onMobileSearchOpenChange: (open: boolean) => void;
}

export default function ExplorerNavigationBar({
  activeFilter,
  currentPath,
  onNavigate,
  onNavigateInNewTab,
  onMove,
  search,
  onSearchChange,
  locationLabel,
  onOpenSidebar,
  mobileSearchOpen,
  onMobileSearchOpenChange,
}: ExplorerNavigationBarProps) {
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const FilterIcon = activeFilter ? FILTER_ICONS[activeFilter] : null;
  const parentPath = currentPath
    .split("/")
    .filter(Boolean)
    .slice(0, -1)
    .join("/");

  useEffect(() => {
    const focusGlobalSearch = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }
      event.preventDefault();
      const compact = window.matchMedia("(max-width: 767px)").matches;
      if (compact) {
        onMobileSearchOpenChange(true);
        window.requestAnimationFrame(() => {
          mobileSearchInputRef.current?.focus();
          mobileSearchInputRef.current?.select();
        });
        return;
      }
      desktopSearchInputRef.current?.focus();
      desktopSearchInputRef.current?.select();
    };

    document.addEventListener("keydown", focusGlobalSearch);
    return () => document.removeEventListener("keydown", focusGlobalSearch);
  }, [onMobileSearchOpenChange]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const frame = window.requestAnimationFrame(() => {
      mobileSearchInputRef.current?.focus();
    });
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMobileSearchOpenChange(false);
    };
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [mobileSearchOpen, onMobileSearchOpenChange]);

  return (
    <div className="relative flex min-h-16 items-center gap-2 px-2.5 py-2 md:gap-3 md:px-4">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className={cn(btn.icon, "md:hidden")}
      >
        <Menu className="size-4" />
      </button>

      <div className="hidden items-center gap-0.5 md:flex">
        <NavButton label="Back" onClick={() => window.history.back()}>
          <ArrowLeft />
        </NavButton>
        <NavButton label="Forward" onClick={() => window.history.forward()}>
          <ArrowRight />
        </NavButton>
        <NavButton
          label="Go up one level"
          onClick={() => onNavigate(parentPath)}
          disabled={!!activeFilter || !currentPath}
        >
          <ArrowUp />
        </NavButton>
      </div>

      <div className="flex h-12 min-w-0 flex-1 items-center overflow-hidden rounded-full bg-surface-alt px-4 md:min-w-30">
        {!activeFilter ? (
          <Breadcrumb
            currentPath={currentPath}
            onNavigate={onNavigate}
            onNavigateInNewTab={onNavigateInNewTab}
            onMove={onMove}
          />
        ) : (
          <span className="flex h-8 min-w-0 items-center gap-2 overflow-hidden text-13 leading-none font-medium text-text">
            {FilterIcon ? (
              <FilterIcon className="size-3.5 text-muted" aria-hidden="true" />
            ) : null}
            {locationLabel}
          </span>
        )}
      </div>

      <ExplorerSearchField
        className="hidden w-[min(28vw,330px)] min-w-47.5 flex-[0_1_330px] md:inline-flex"
        inputRef={desktopSearchInputRef}
        locationLabel={locationLabel}
        search={search}
        onSearchChange={onSearchChange}
      />

      <button
        type="button"
        className={cn(btn.icon, "relative flex-none md:hidden")}
        aria-label={search ? `Search: ${search}` : "Open search"}
        aria-expanded={mobileSearchOpen}
        aria-controls="mobile-search-panel"
        onClick={() => onMobileSearchOpenChange(true)}
      >
        <Search className="size-4" />
        {search ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 bottom-1.5 size-1.5 rounded-full border border-surface bg-accent"
          />
        ) : null}
      </button>

      {mobileSearchOpen ? (
        <div
          id="mobile-search-panel"
          className="absolute inset-0 z-40 flex items-center gap-2 bg-app px-2.5 py-2 md:hidden"
        >
          <ExplorerSearchField
            className="min-w-0 flex-1"
            inputRef={mobileSearchInputRef}
            locationLabel={locationLabel}
            search={search}
            onSearchChange={onSearchChange}
          />
          <button
            type="button"
            className={btn.icon}
            aria-label="Close search"
            onClick={() => onMobileSearchOpenChange(false)}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-10 cursor-pointer items-center justify-center rounded-full",
        "border-0 bg-transparent text-muted [&>svg]:size-4.5",
        "hover:not-disabled:bg-state-hover hover:not-disabled:text-text",
        "disabled:cursor-default disabled:opacity-35",
      )}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
