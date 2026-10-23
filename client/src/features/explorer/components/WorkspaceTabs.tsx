import { Plus, X } from "lucide-react";
import type { WorkspaceTab } from "../model/types";
import { cn } from "@/shared/ui/cn";
import FileIcon from "@/shared/files/FileIcon";

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeTabId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
}

export default function WorkspaceTabs({
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onNewTab,
}: WorkspaceTabsProps) {
  return (
    <nav
      className="flex h-11 shrink-0 items-end overflow-hidden bg-app px-2 pt-2"
      aria-label="Explorer tabs"
    >
      <div
        className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const tabIndex = tabs.findIndex((candidate) => candidate.id === tab.id);
          return (
            <div
              key={tab.id}
              data-workspace-tab={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={cn(
                "group flex h-9 w-43.5 flex-none cursor-default items-center gap-2",
                "rounded-t-lg rounded-b-none border-0 pr-2 pl-3.5 text-muted outline-none",
                "transition-colors duration-150 hover:bg-state-hover",
                active && "bg-surface text-text hover:bg-surface",
              )}
              onClick={() => onActivate(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onActivate(tab.id);
                  return;
                }

                let nextIndex = -1;
                if (event.key === "ArrowRight") {
                  nextIndex = (tabIndex + 1) % tabs.length;
                } else if (event.key === "ArrowLeft") {
                  nextIndex = (tabIndex - 1 + tabs.length) % tabs.length;
                } else if (event.key === "Home") {
                  nextIndex = 0;
                } else if (event.key === "End") {
                  nextIndex = tabs.length - 1;
                }

                if (nextIndex === -1) return;
                event.preventDefault();
                event.stopPropagation();
                const nextTab = tabs[nextIndex];
                onActivate(nextTab.id);
                requestAnimationFrame(() => {
                  document
                    .querySelectorAll<HTMLElement>("[data-workspace-tab]")
                    .item(nextIndex)
                    ?.focus({ preventScroll: true });
                });
              }}
            >
              <FileIcon name={tab.name} isFolder size="xs" />
              <span className="min-w-0 flex-1 truncate">{tab.name}</span>
              <button
                type="button"
                className={cn(
                  "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full",
                  "border-0 bg-transparent text-muted opacity-0",
                  "group-hover:opacity-100 group-focus-within:opacity-100",
                  "hover:bg-state-hover hover:text-text",
                  active && "opacity-100",
                )}
                aria-label={`Close aba ${tab.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="mb-0.5 ml-1 flex size-8 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted hover:bg-state-hover hover:text-text"
          onClick={onNewTab}
          aria-label="New tab"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
