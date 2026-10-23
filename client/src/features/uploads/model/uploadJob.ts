import type { UploadEntry } from "../lib/uploadEntries";
import type { UploadItem } from "./uploadCenter";

export interface UploadJob {
  id: string;
  entry: UploadEntry;
  destPath: string;
  autorename: boolean;
  uploadId: string | null;
  xhr: XMLHttpRequest | null;
  controller: AbortController | null;
  paused: boolean;
  cancelled: boolean;
  running: boolean;
  resumeWaiter: ((resume: boolean) => void) | null;
  sampleAt: number;
  sampleBytes: number;
  speed: number;
}

export function createUploadItem(
  id: string,
  entry: UploadEntry,
  destPath: string,
): UploadItem {
  return {
    id,
    name: entry.relativePath,
    destination: destPath,
    size: entry.file.size,
    bytesTransferred: 0,
    progress: 0,
    speed: 0,
    remainingSeconds: null,
    status: "waiting",
    retryable: true,
  };
}
