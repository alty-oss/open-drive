import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { logClientError } from "@/shared/lib/logger";
import {
  CHUNK_SIZE,
  UploadFailure,
  checksumBlob,
  cleanupChunkUpload,
  completeChunkUpload,
  initializeChunkUpload as initializeChunkUploadRequest,
} from "../api/uploadApi";
import { transferWithXhr } from "../api/uploadTransport";
import type { UploadItem } from "../model/uploadCenter";
import type { UploadJob } from "../model/uploadJob";

interface UseUploadRunnerOptions {
  setUploads: Dispatch<SetStateAction<UploadItem[]>>;
  refreshAll: () => void | Promise<void>;
}

export function useUploadRunner({
  setUploads,
  refreshAll,
}: UseUploadRunnerOptions) {
  const jobsRef = useRef(new Map<string, UploadJob>());
  const updateItem = useCallback(
    (
      id: string,
      patch:
        | Partial<UploadItem>
        | ((item: UploadItem) => Partial<UploadItem>),
    ) => {
      setUploads((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(typeof patch === "function" ? patch(item) : patch),
              }
            : item,
        ),
      );
    },
    [setUploads],
  );
  const updateProgress = useCallback(
    (job: UploadJob, bytesTransferred: number) => {
      const now = performance.now();
      const elapsed = Math.max((now - job.sampleAt) / 1000, 0.001);
      const byteDelta = Math.max(0, bytesTransferred - job.sampleBytes);
      if (byteDelta > 0 && elapsed >= 0.15) {
        const instantSpeed = byteDelta / elapsed;
        job.speed =
          job.speed > 0 ? job.speed * 0.65 + instantSpeed * 0.35 : instantSpeed;
        job.sampleAt = now;
        job.sampleBytes = bytesTransferred;
      }
      const size = job.entry.file.size;
      const progress =
        size > 0
          ? Math.min(100, Math.round((bytesTransferred / size) * 100))
          : 100;
      updateItem(job.id, {
        bytesTransferred,
        progress,
        speed: job.speed,
        remainingSeconds:
          job.speed > 0
            ? Math.max(0, (size - bytesTransferred) / job.speed)
            : null,
      });
    },
    [updateItem],
  );
  const waitUntilResumed = useCallback((job: UploadJob) => {
    if (job.cancelled) return Promise.resolve(false);
    if (!job.paused) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      job.resumeWaiter = resolve;
    });
  }, []);
  const uploadDirect = useCallback(
    async (job: UploadJob) => {
      while (!job.cancelled) {
        if (!(await waitUntilResumed(job))) return false;
        const form = new FormData();
        form.append("files", job.entry.file);
        const query = new URLSearchParams({ autorename: String(job.autorename) });
        if (job.destPath) query.set("path", job.destPath);
        job.sampleAt = performance.now();
        job.sampleBytes = 0;
        job.speed = 0;
        updateProgress(job, 0);
        const result = await transferWithXhr({
          job,
          url: `/api/upload?${query}`,
          form,
          baseBytes: 0,
          onProgress: updateProgress,
        });
        if (result.kind === "ok") return true;
        if (result.kind === "cancelled") return false;
        if (result.kind === "paused") continue;
        throw new UploadFailure(result.message);
      }
      return false;
    },
    [updateProgress, waitUntilResumed],
  );
  const initializeChunkUpload = useCallback(
    async (job: UploadJob) => {
      const file = job.entry.file;
      while (!job.cancelled && !job.uploadId) {
        if (!(await waitUntilResumed(job))) return false;
        const controller = new AbortController();
        job.controller = controller;
        try {
          job.uploadId = await initializeChunkUploadRequest(
            {
              filename: file.name,
              totalChunks: Math.ceil(file.size / CHUNK_SIZE),
              fileSize: file.size,
              destPath: job.destPath,
              autorename: job.autorename,
            },
            controller.signal,
          );
        } catch (error) {
          if (controller.signal.aborted && (job.paused || job.cancelled)) continue;
          throw error;
        } finally {
          job.controller = null;
        }
      }
      return !job.cancelled;
    },
    [waitUntilResumed],
  );
  const uploadChunked = useCallback(
    async (job: UploadJob) => {
      const file = job.entry.file;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      if (!(await initializeChunkUpload(job)) || !job.uploadId) return false;
      for (let index = 0; index < totalChunks; index++) {
        while (!job.cancelled) {
          if (!(await waitUntilResumed(job))) return false;
          const start = index * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const checksum = await checksumBlob(chunk);
          if (job.cancelled) return false;
          if (job.paused) continue;
          const form = new FormData();
          form.append("chunk", chunk);
          const result = await transferWithXhr({
            job,
            url: `/api/upload-chunk/${job.uploadId}?index=${index}`,
            form,
            baseBytes: start,
            headers: checksum ? { "X-Chunk-SHA256": checksum } : undefined,
            onProgress: updateProgress,
          });
          if (result.kind === "ok") {
            updateProgress(job, end);
            break;
          }
          if (result.kind === "cancelled") return false;
          if (result.kind === "paused") continue;
          throw new UploadFailure(result.message);
        }
      }
      if (job.cancelled || !job.uploadId) return false;
      await completeChunkUpload(job.uploadId);
      job.uploadId = null;
      updateProgress(job, file.size);
      return true;
    },
    [initializeChunkUpload, updateProgress, waitUntilResumed],
  );
  const runJob = useCallback(
    async (job: UploadJob) => {
      if (job.running || job.cancelled) return;
      job.running = true;
      job.sampleAt = performance.now();
      job.sampleBytes = 0;
      job.speed = 0;
      updateItem(job.id, {
        status: "uploading",
        error: undefined,
        startedAt: Date.now(),
        endedAt: undefined,
        retryable: true,
        speed: 0,
        remainingSeconds: null,
      });
      try {
        const completed =
          job.entry.file.size > CHUNK_SIZE
            ? await uploadChunked(job)
            : await uploadDirect(job);
        if (job.cancelled) {
          updateItem(job.id, {
            status: "cancelled",
            error: "Upload canceled",
            speed: 0,
            remainingSeconds: null,
            endedAt: Date.now(),
          });
        } else if (completed) {
          updateItem(job.id, {
            status: "done",
            progress: 100,
            bytesTransferred: job.entry.file.size,
            speed: 0,
            remainingSeconds: 0,
            endedAt: Date.now(),
          });
          await refreshAll();
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected upload error";
        if (job.uploadId) {
          void cleanupChunkUpload(job.uploadId).catch((cleanupError) =>
            logClientError("upload.error_cleanup_failed", cleanupError, {
              uploadId: job.uploadId,
            }),
          );
          job.uploadId = null;
        }
        logClientError("upload.failed", error, {
          fileName: job.entry.file.name,
        });
        updateItem(job.id, {
          status: "error",
          error: message,
          speed: 0,
          remainingSeconds: null,
          endedAt: Date.now(),
        });
      } finally {
        job.running = false;
        job.xhr = null;
        job.controller = null;
      }
    },
    [refreshAll, updateItem, uploadChunked, uploadDirect],
  );

  return { jobsRef, runJob, updateItem };
}
