import {
  AlertCircle,
  Ban,
  Check,
  Clock3,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import FileIcon from "@/shared/files/FileIcon";
import { formatSize } from "@/shared/lib/format";
import { cn } from "@/shared/ui/cn";
import { spinner } from "@/shared/ui/styles";
import {
  formatRemainingTime,
  type UploadConflictResolution,
  type UploadItem,
} from "../model/uploadCenter";

const statusIcon = "size-4 flex-none";
const actionRow =
  "flex flex-wrap gap-1.5 " +
  "[&>button]:inline-flex [&>button]:h-8 [&>button]:items-center [&>button]:justify-center " +
  "[&>button]:gap-1.5 [&>button]:rounded-full [&>button]:border-0 " +
  "[&>button]:bg-surface-high [&>button]:px-3 [&>button]:text-11 [&>button]:font-medium " +
  "[&>button]:text-muted-strong [&>button:hover]:bg-accent-soft " +
  "[&>button:hover]:text-on-accent-container [&>button>svg]:size-3";

export interface UploadActions {
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onResolveConflict: (
    id: string,
    resolution: UploadConflictResolution,
  ) => void;
}

export function UploadSection({
  title,
  items,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onResolveConflict,
}: UploadActions & {
  title: string;
  items: UploadItem[];
}) {
  return (
    <section>
      <h2 className="sticky top-0 z-1 border-b border-border-subtle bg-surface px-3.25 py-1.75 text-11 font-semibold tracking-[0.09em] text-muted uppercase backdrop-blur-[8px]">
        {title}
      </h2>
      {items.map((item) => (
        <UploadRow
          key={item.id}
          item={item}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onRetry={onRetry}
          onResolveConflict={onResolveConflict}
        />
      ))}
    </section>
  );
}

function UploadRow({
  item,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onResolveConflict,
}: UploadActions & {
  item: UploadItem;
}) {
  return (
    <article
      className={cn(
        "grid gap-1.75 border-b border-border-subtle px-3.25 py-2.5 last:border-b-0",
        item.status === "paused" && "[&_[data-progress-fill]]:bg-muted",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.25 [&>svg:last-child]:size-4 [&>svg:last-child]:flex-none">
        <FileIcon name={item.name} size="sm" />
        <div className="grid min-w-0 flex-1 gap-0.5 [&>p]:overflow-hidden [&>p]:text-xs [&>p]:font-semibold [&>p]:text-ellipsis [&>p]:whitespace-nowrap [&>span]:overflow-hidden [&>span]:text-11 [&>span]:text-ellipsis [&>span]:whitespace-nowrap [&>span]:text-muted">
          <p title={item.name}>{item.name}</p>
          <span>{uploadStatusText(item)}</span>
        </div>
        <UploadStatusIcon item={item} />
      </div>

      {item.status === "uploading" || item.status === "paused" ? (
        <div className="h-1 overflow-hidden rounded-full bg-surface-highest" aria-label={`${item.progress}% complete`}>
          <span
            data-progress-fill
            className="block h-full rounded-[inherit] bg-accent transition-[width] duration-160 ease-out"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      ) : null}

      {item.error ? <p className="rounded-sm bg-danger-soft px-2 py-1.5 text-11 leading-[1.4] text-danger">{item.error}</p> : null}

      {item.status === "conflict" ? (
        <div className={actionRow}>
          <button
            type="button"
            onClick={() => onResolveConflict(item.id, "replace")}
          >
            Substituir
          </button>
          <button
            type="button"
            onClick={() => onResolveConflict(item.id, "rename")}
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => onResolveConflict(item.id, "skip")}
          >
            Ignorar
          </button>
        </div>
      ) : null}

      {item.status === "uploading" ? (
        <div className={actionRow}>
          <button type="button" onClick={() => onPause(item.id)}>
            <Pause />
            Pause
          </button>
          <button type="button" onClick={() => onCancel(item.id)}>
            <Ban />
            Cancel
          </button>
        </div>
      ) : null}

      {item.status === "paused" ? (
        <div className={actionRow}>
          <button type="button" onClick={() => onResume(item.id)}>
            <Play />
            Resume
          </button>
          <button type="button" onClick={() => onCancel(item.id)}>
            <Ban />
            Cancel
          </button>
        </div>
      ) : null}

      {item.status === "error" && item.retryable ? (
        <div className={actionRow}>
          <button type="button" onClick={() => onRetry(item.id)}>
            <RotateCcw />
            Try again
          </button>
        </div>
      ) : null}
    </article>
  );
}

function uploadStatusText(item: UploadItem) {
  if (item.status === "waiting") return "Checking destination…";
  if (item.status === "conflict") return `Conflict in ${item.destination || "My Drive"}`;
  if (item.status === "uploading") {
    const speed = item.speed > 0 ? `${formatSize(item.speed)}/s` : "Calculating…";
    return `${item.progress}% · ${speed} · ${formatRemainingTime(item.remainingSeconds)}`;
  }
  if (item.status === "paused") return `Paused at ${item.progress}%`;
  if (item.status === "done") {
    return item.endedAt
      ? `Completed · ${new Date(item.endedAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Completed";
  }
  if (item.status === "cancelled") return "Cancelled";
  return "Upload failed";
}

function UploadStatusIcon({ item }: { item: UploadItem }) {
  if (item.status === "uploading" || item.status === "waiting") {
    return (
      <span
        className={spinner}
        aria-label={item.status === "waiting" ? "Waiting" : "Uploading"}
      />
    );
  }
  if (item.status === "paused") {
    return <Pause className={cn(statusIcon, "text-muted")} aria-label="Paused" />;
  }
  if (item.status === "done") {
    return <Check className={cn(statusIcon, "text-success")} aria-label="Completed" />;
  }
  if (item.status === "conflict") {
    return <AlertCircle className={cn(statusIcon, "text-warning")} aria-label="Conflict" />;
  }
  if (item.status === "cancelled") {
    return <Ban className={cn(statusIcon, "text-muted")} aria-label="Cancelled" />;
  }
  if (item.status === "error") {
    return <AlertCircle className={cn(statusIcon, "text-danger")} aria-label="Error" />;
  }
  return <Clock3 className={cn(statusIcon, "text-muted")} />;
}
