import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { btn, scrollGutter, z } from "@/shared/ui/styles";

import {
  isUploadActive,
  isUploadTerminal,
  type UploadItem,
} from "../model/uploadCenter";
import { UploadSection, type UploadActions } from "./UploadList";

interface UploadPanelProps extends UploadActions {
  items: UploadItem[];
  onClearCompleted: () => void;
}

export default function UploadPanel({
  items,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onResolveConflict,
  onClearCompleted,
}: UploadPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  const activeItems = items.filter(
    (item) => isUploadActive(item.status) || item.status === "conflict",
  );
  const finishedItems = items.filter((item) => isUploadTerminal(item.status));
  const uploadingCount = items.filter(
    (item) => item.status === "uploading",
  ).length;
  const pausedCount = items.filter((item) => item.status === "paused").length;
  const conflictCount = items.filter(
    (item) => item.status === "conflict",
  ).length;
  const headerText =
    activeItems.length > 0
      ? [
          uploadingCount > 0 ? `${uploadingCount} uploading` : "",
          pausedCount > 0 ? `${pausedCount} paused` : "",
          conflictCount > 0
            ? `${conflictCount} conflict${conflictCount > 1 ? "s" : ""}`
            : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "Completed uploads";

  return (
    <aside
      className={cn(
        "fixed right-2 bottom-2",
        "w-[calc(100vw-16px)] sm:right-4 sm:bottom-4 sm:w-[min(390px,calc(100vw-32px))]",
        "animate-slide-up overflow-hidden rounded-lg bg-surface-alt text-text shadow-e2",
        z.overlay,
      )}
      aria-label="Upload center"
      aria-live="polite"
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border-subtle py-2 pr-2.5 pl-4">
        <div className="grid min-w-0 gap-px [&>strong]:overflow-hidden [&>strong]:text-13 [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap [&>span]:text-11 [&>span]:text-muted">
          <strong>{headerText}</strong>
          <span>
            {activeItems.length > 0
              ? `${activeItems.length} in queue`
              : `${finishedItems.length} completed`}
          </span>
        </div>
        <div className="flex flex-none gap-0.5">
          {finishedItems.length > 0 ? (
            <button
              type="button"
              className={btn.icon}
              aria-label="Close completed uploads"
              title="Close"
              onClick={onClearCompleted}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            className={btn.icon}
            aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div
          className={cn(
            "max-h-[58dvh] overflow-y-auto sm:max-h-[min(62vh,500px)]",
            scrollGutter,
          )}
        >
          {activeItems.length > 0 ? (
            <UploadSection
              title="In progress"
              items={activeItems}
              onPause={onPause}
              onResume={onResume}
              onCancel={onCancel}
              onRetry={onRetry}
              onResolveConflict={onResolveConflict}
            />
          ) : null}
          {finishedItems.length > 0 ? (
            <UploadSection
              title="Completed"
              items={finishedItems}
              onPause={onPause}
              onResume={onResume}
              onCancel={onCancel}
              onRetry={onRetry}
              onResolveConflict={onResolveConflict}
            />
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
