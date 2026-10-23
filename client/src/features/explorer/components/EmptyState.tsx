import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import { FolderOpen, FolderSearch, Trash2 } from "lucide-react";

export interface EmptyStateAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  primary?: boolean;
}

interface EmptyStateProps {
  message: string;
  hint: string;
  actions?: EmptyStateAction[];
}

export default function EmptyState({
  message,
  hint,
  actions = [],
}: EmptyStateProps) {
  const lowerMessage = message.toLowerCase();
  const isTrash = lowerMessage.includes("trash");
  const isFolder = lowerMessage.includes("folder");
  const Icon = isTrash ? Trash2 : isFolder ? FolderOpen : FolderSearch;

  return (
    <div className="flex h-full min-h-[320px] items-center justify-center bg-surface px-4 py-10">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border border-border-subtle bg-surface-alt text-accent">
          <Icon className="h-7 w-7" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-sm font-semibold text-text">{message}</p>
        <span className="mt-1.5 block text-xs leading-relaxed text-muted">
          {hint}
        </span>
        {actions.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {actions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  className={cn(
                    action.primary ? btn.primary : btn.tonal,
                    "h-9 px-3 text-xs font-semibold",
                  )}
                  onClick={action.onClick}
                >
                  <ActionIcon className="h-3.5 w-3.5" />
                  {action.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
