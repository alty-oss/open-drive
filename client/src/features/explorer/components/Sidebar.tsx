import { type ReactNode } from "react";
import {
  Folder,
  HardDrive,
  Link2,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  Star,
  Sun,
  X,
} from "lucide-react";
import { formatSize } from "@/shared/lib/format";
import { cn } from "@/shared/ui/cn";
import { btn, scrollGutter, z } from "@/shared/ui/styles";
import type { StorageStats } from "@/shared/files/storageTypes";
import type { FileFilter } from "../model/types";
import type { ThemeMode } from "@/shared/ui/theme";

export interface SidebarFavorite {
  path: string;
  name: string;
}

interface SidebarProps {
  totalSize: number;
  trashCount: number;
  stats: StorageStats | null;
  activeFilter: FileFilter;
  currentPath: string;
  favorites: SidebarFavorite[];
  onFavoriteOpen: (path: string) => void;
  onFavoriteOpenInNewTab: (path: string) => void;
  onFavoriteRemove: (path: string) => void;
  onFilterChange: (filter: FileFilter) => void;
  onFilterOpenInNewTab: (filter: FileFilter) => void;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}


const navRow =
  "flex h-10 items-center gap-3 rounded-full border-0 bg-transparent px-4 " +
  "text-left cursor-pointer transition-colors duration-150";

const navRowCompact = "w-10 justify-center self-center p-0";

export default function Sidebar({
  totalSize,
  trashCount,
  stats,
  activeFilter,
  currentPath,
  favorites,
  onFavoriteOpen,
  onFavoriteOpenInNewTab,
  onFavoriteRemove,
  onFilterChange,
  onFilterOpenInNewTab,
  onLogout,
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const handleNav = (filter: FileFilter) => {
    onFilterChange(filter);
    onClose();
  };
  const handleNavNewTab = (filter: FileFilter) => {
    onFilterOpenInNewTab(filter);
    onClose();
  };

  const handleFavorite = (path: string) => {
    onFavoriteOpen(path);
    onClose();
  };
  const handleFavoriteNewTab = (path: string) => {
    onFavoriteOpenInNewTab(path);
    onClose();
  };

  const quota = stats?.quota ?? 0;
  const quotaUsed = stats?.totalUsed ?? totalSize;
  const storagePercent = quota
    ? Math.min(100, Math.round((quotaUsed / quota) * 100))
    : 0;

  const sidebarContent = (compact = false) => (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-x-hidden overflow-y-auto py-3.5 pr-0.5 pl-3",
        scrollGutter,
        compact && "pr-1 pl-3.5",
      )}
    >
      <div
        className={cn(
          "mb-4 flex min-h-9 min-w-0 shrink-0 items-center justify-between gap-2 px-0.5",
          compact && "mb-3 justify-center p-0",
        )}
      >
        {!compact ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
              <img
                src="/brand-mark.png"
                alt=""
                className="block size-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">
                OpenDrive
              </div>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={compact ? "Expand navigation" : "Collapse navigation"}
          className="hidden size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted hover:bg-state-hover hover:text-text md:flex"
        >
          {compact ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={onClose}
          aria-label="Close navigation"
          className={cn(btn.icon, "md:hidden")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <SidebarSection label="Locations" compact={compact}>
        <SidebarLink
          icon={<HardDrive />}
          active={activeFilter === null}
          compact={compact}
          onClick={() => handleNav(null)}
          onAuxClick={() => handleNavNewTab(null)}
        >
          My Drive
        </SidebarLink>
        <SidebarLink
          icon={<Trash2 />}
          active={activeFilter === "trash"}
          compact={compact}
          onClick={() => handleNav("trash")}
          onAuxClick={() => handleNavNewTab("trash")}
        >
          Trash
        </SidebarLink>
        <SidebarLink
          icon={<Link2 />}
          active={activeFilter === "links"}
          compact={compact}
          onClick={() => handleNav("links")}
          onAuxClick={() => handleNavNewTab("links")}
        >
          Links
        </SidebarLink>
      </SidebarSection>

      <SidebarSection label="Favorites" compact={compact}>
        {favorites.map((favorite) => (
          <div key={favorite.path} className="group relative">
            <SidebarLink
              icon={<Folder />}
              active={activeFilter === null && currentPath === favorite.path}
              compact={compact}
              title={favorite.path}
              onClick={() => handleFavorite(favorite.path)}
              onAuxClick={() => handleFavoriteNewTab(favorite.path)}
            >
              {favorite.name}
            </SidebarLink>
            {!compact ? (
              <button
                type="button"
                aria-label={`Remove ${favorite.name} from favorites`}
                title="Remove from favorites"
                onClick={() => onFavoriteRemove(favorite.path)}
                className="absolute top-1 right-2 hidden size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted hover:bg-state-hover hover:text-text focus-visible:flex group-focus-within:flex group-hover:flex"
              >
                <Star className="size-3.5 fill-current" />
              </button>
            ) : null}
          </div>
        ))}
        {favorites.length === 0 && !compact ? (
          <p className="m-0 px-4 text-xs leading-5 text-muted">
            Right-click a folder and choose “Add to favorites”.
          </p>
        ) : null}
      </SidebarSection>

      <div className="mt-auto flex flex-col gap-2.5 pt-2.5">
        {!compact ? (
          <div className="rounded-md bg-surface-alt p-4">
            <div className="min-w-0 text-13 font-medium text-text">
              Storage
            </div>
            <div className="mt-2.75 flex min-w-0 items-baseline gap-1.25 [&>span]:min-w-0 [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap [&>span]:text-11 [&>span]:text-muted [&>strong]:min-w-0 [&>strong]:overflow-hidden [&>strong]:text-base [&>strong]:font-semibold [&>strong]:tracking-[-0.02em] [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap [&>strong]:text-text">
              {stats ? (
                <>
                  <strong>{formatSize(quotaUsed)}</strong>
                  <span>of {formatSize(quota)}</span>
                </>
              ) : (
                <span>Loading...</span>
              )}
            </div>
            <div className="mt-2.25 h-1.5 overflow-hidden rounded-full bg-surface-highest">
              <div
                className="h-full rounded-[inherit] bg-accent transition-[width] duration-160 ease-[ease]"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
        ) : null}


        <button
          type="button"
          onClick={onToggleTheme}
          className={cn(
            navRow,
            "text-muted-strong hover:bg-state-hover hover:text-text",
            compact && navRowCompact,
          )}
          aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {!compact ? (
            <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className={cn(
            navRow,
            "text-muted-strong hover:bg-state-hover hover:text-text",
            compact && navRowCompact,
          )}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          {!compact ? <span>Sign out</span> : null}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <nav
        className={cn(
          "hidden w-62 shrink-0 overflow-hidden border-r border-border-subtle bg-sidebar transition-[width] duration-160 ease-[ease] md:flex",
          collapsed && "w-17",
        )}
      >
        {sidebarContent(collapsed)}
      </nav>

      {open && (
        <div className={cn("fixed inset-0 flex md:hidden", z.drawer)}>
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-black/40"
            aria-label="Close navigation"
            onClick={onClose}
          />
          <nav className="relative flex h-full w-72 max-w-[86vw] flex-col bg-sidebar shadow-e4">
            {sidebarContent(false)}
          </nav>
        </div>
      )}
    </>
  );
}

function SidebarSection({
  label,
  compact,
  children,
}: {
  label: string;
  compact: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("mb-4", compact && "mb-3")}>
      <h2
        className={cn(
          "mt-0 mb-1.5 px-4 text-11 leading-5 font-medium tracking-[0.07em] text-muted uppercase",
          compact && "hidden",
        )}
      >
        {label}
      </h2>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

function SidebarLink({
  icon,
  children,
  onClick,
  onAuxClick,
  active,
  compact,
  title,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  onAuxClick?: () => void;
  active?: boolean;
  compact: boolean;
  title?: string;
}) {
  const accessibleLabel = typeof children === "string" ? children : undefined;

  return (
    <button
      type="button"
      aria-label={accessibleLabel}
      title={title}
      onClick={onClick}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onAuxClick={(event) => {
        if (event.button !== 1 || !onAuxClick) return;
        event.preventDefault();
        onAuxClick();
      }}
      className={cn(
        navRow,
        "w-full text-muted-strong hover:bg-state-hover hover:text-text",
        active && "bg-state-selected font-medium text-on-accent-container",
        compact && navRowCompact,
      )}
    >
      <span
        className={cn(
          "[&>svg]:size-4",
          compact && "flex items-center justify-center",
        )}
      >
        {icon}
      </span>
      {!compact ? (
        <span className="min-w-0 flex-1 truncate">{children}</span>
      ) : null}
    </button>
  );
}
