export type UploadStatus =
  | "waiting"
  | "conflict"
  | "uploading"
  | "paused"
  | "done"
  | "error"
  | "cancelled";

export type UploadConflictResolution = "replace" | "rename" | "skip";

export interface UploadItem {
  id: string;
  name: string;
  destination: string;
  size: number;
  bytesTransferred: number;
  progress: number;
  speed: number;
  remainingSeconds: number | null;
  status: UploadStatus;
  error?: string;
  startedAt?: number;
  endedAt?: number;
  retryable: boolean;
}

const TERMINAL_STATUSES = new Set<UploadStatus>([
  "done",
  "error",
  "cancelled",
]);

export function isUploadActive(status: UploadStatus) {
  return status === "waiting" || status === "uploading" || status === "paused";
}

export function isUploadTerminal(status: UploadStatus) {
  return TERMINAL_STATUSES.has(status);
}

export function formatRemainingTime(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return "Calculating…";
  }
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} s remaining`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min remaining`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} h${remainder ? ` ${remainder} min` : ""} remaining`;
}
