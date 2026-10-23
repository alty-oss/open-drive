import { useCallback, useEffect, useRef, useState } from "react";
import {
  entriesFromFileList,
  joinPath,
  parentOf,
  type DroppedTree,
  type UploadEntry,
} from "../lib/uploadEntries";
import { logClientError } from "@/shared/lib/logger";
import { formatSize } from "@/shared/lib/format";
import {
  isUploadActive,
  isUploadTerminal,
  type UploadConflictResolution,
  type UploadItem,
} from "../model/uploadCenter";
import {
  cleanupChunkUpload,
  ensureUploadFolders,
  hasUploadDuplicate,
} from "../api/uploadApi";
import {
  createUploadItem,
  type UploadJob,
} from "../model/uploadJob";

import { useUploadRunner } from "./useUploadRunner";

const AUTO_DISMISS_MS = 4000;

interface UseUploadQueueOptions {
  currentPath: string;
  refreshAll: () => void | Promise<void>;

  maxUploadSize?: number;
  available?: number;
  onToast?: (message: string) => void;
}

export function useUploadQueue({
  currentPath,
  refreshAll,
  maxUploadSize,
  available,
  onToast,
}: UseUploadQueueOptions) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const nextIdRef = useRef(1);
  const { jobsRef, runJob, updateItem } = useUploadRunner({
    setUploads,
    refreshAll,
  });

  const nextId = useCallback(() => {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ?? `upload-${Date.now()}-${nextIdRef.current++}`;
  }, []);

  const appendRejected = useCallback(
    (entries: UploadEntry[], reason: string) => {
      const now = Date.now();
      const items = entries.map((entry) => ({
        ...createUploadItem(nextId(), entry, currentPath),
        status: "error" as const,
        error: reason,
        endedAt: now,
        retryable: false,
      }));
      setUploads((current) => [...items, ...current].slice(0, 100));
    },
    [currentPath, nextId],
  );

  const hasDuplicate = useCallback(
    async (entry: UploadEntry, destPath: string) => {
      try {
        return await hasUploadDuplicate(entry.file.name, destPath);
      } catch (error) {
        logClientError("upload.duplicate_check_failed", error, {
          fileName: entry.file.name,
        });
        return false;
      }
    },
    [],
  );

  const enqueueEntries = useCallback(
    async (entries: UploadEntry[], emptyDirectories: string[]) => {
      if (emptyDirectories.length > 0) {
        try {
          const created = await ensureUploadFolders(currentPath, emptyDirectories);
          if (!created) {
            onToast?.("Some empty folders could not be created");
          }
        } catch (error) {
          logClientError("upload.ensure_folders_failed", error);
          onToast?.("Some empty folders could not be created");
        }
      }

      const jobs = entries.map((entry) => {
        const id = nextId();
        const destPath = joinPath(currentPath, parentOf(entry.relativePath));
        const job: UploadJob = {
          id,
          entry,
          destPath,
          autorename: false,
          uploadId: null,
          xhr: null,
          controller: null,
          paused: false,
          cancelled: false,
          running: false,
          resumeWaiter: null,
          sampleAt: performance.now(),
          sampleBytes: 0,
          speed: 0,
        };
        jobsRef.current.set(id, job);
        return job;
      });
      const batchNames = new Set<string>();
      const batchConflicts = new Set<string>();
      for (const job of jobs) {
        const key = `${job.destPath}\0${job.entry.file.name.toLocaleLowerCase("en-US")}`;
        if (batchNames.has(key)) batchConflicts.add(job.id);
        batchNames.add(key);
      }
      setUploads((current) => [
        ...jobs.map((job) =>
          createUploadItem(job.id, job.entry, job.destPath),
        ),
        ...current,
      ].slice(0, 100));

      await Promise.all(
        jobs.map(async (job) => {
          if (
            batchConflicts.has(job.id) ||
            (await hasDuplicate(job.entry, job.destPath))
          ) {
            updateItem(job.id, {
              status: "conflict",
              error: "A file with this name already exists in the destination",
            });
            return;
          }
          await runJob(job);
        }),
      );
    },
    [currentPath, hasDuplicate, nextId, onToast, runJob, updateItem],
  );

  const handleUploadTree = useCallback(
    async (tree: DroppedTree) => {
      let entries = tree.entries;
      if (entries.length === 0 && tree.emptyDirectories.length === 0) return;

      if (tree.truncated) {
        onToast?.(
          "The folder has too many items; only the first ones were read. Upload in smaller batches.",
        );
      }

      if (maxUploadSize) {
        const oversized = entries.filter(
          (entry) => entry.file.size > maxUploadSize,
        );
        if (oversized.length > 0) {
          appendRejected(
            oversized,
            `The file exceeds the ${formatSize(maxUploadSize)} limit`,
          );
          entries = entries.filter(
            (entry) => entry.file.size <= maxUploadSize,
          );
        }
      }

      if (available !== undefined) {
        const incoming = entries.reduce(
          (total, entry) => total + entry.file.size,
          0,
        );
        if (incoming > available) {
          appendRejected(
            entries,
            `Insufficient storage space: the upload needs ${formatSize(incoming)} and only ${formatSize(available)} remains`,
          );
          return;
        }
      }

      if (entries.length === 0 && tree.emptyDirectories.length === 0) return;
      await enqueueEntries(entries, tree.emptyDirectories);
    },
    [
      appendRejected,
      available,
      enqueueEntries,
      maxUploadSize,
      onToast,
    ],
  );

  const handleUpload = useCallback(
    (fileList: FileList | File[]) =>
      handleUploadTree({
        entries: entriesFromFileList(fileList),
        emptyDirectories: [],
        truncated: false,
      }),
    [handleUploadTree],
  );

  const pauseUpload = useCallback(
    (id: string) => {
      const job = jobsRef.current.get(id);
      if (!job || job.cancelled || job.paused) return;
      job.paused = true;
      job.speed = 0;
      job.xhr?.abort();
      job.controller?.abort();
      updateItem(id, {
        status: "paused",
        speed: 0,
        remainingSeconds: null,
      });
    },
    [updateItem],
  );

  const resumeUpload = useCallback(
    (id: string) => {
      const job = jobsRef.current.get(id);
      if (!job || job.cancelled || !job.paused) return;
      job.paused = false;
      job.sampleAt = performance.now();
      updateItem(id, { status: "uploading", error: undefined });
      job.resumeWaiter?.(true);
      job.resumeWaiter = null;
      if (!job.running) void runJob(job);
    },
    [runJob, updateItem],
  );

  const cancelUpload = useCallback(
    (id: string) => {
      const job = jobsRef.current.get(id);
      if (!job || job.cancelled) return;
      job.cancelled = true;
      job.paused = false;
      job.xhr?.abort();
      job.controller?.abort();
      job.resumeWaiter?.(false);
      job.resumeWaiter = null;
      if (job.uploadId) {
        void cleanupChunkUpload(job.uploadId).catch((error) =>
          logClientError("upload.cancel_cleanup_failed", error, {
            uploadId: job.uploadId,
          }),
        );
        job.uploadId = null;
      }
      updateItem(id, {
        status: "cancelled",
        error: "Upload canceled",
        speed: 0,
        remainingSeconds: null,
        endedAt: Date.now(),
      });
    },
    [updateItem],
  );

  const retryUpload = useCallback(
    (id: string) => {
      const job = jobsRef.current.get(id);
      if (!job || job.running) return;
      const resetAndRun = async () => {
        if (job.uploadId) {
          await cleanupChunkUpload(job.uploadId).catch(() => undefined);
        }
        job.uploadId = null;
        job.cancelled = false;
        job.paused = false;
        job.speed = 0;
        updateItem(id, {
          status: "waiting",
          error: undefined,
          progress: 0,
          bytesTransferred: 0,
          speed: 0,
          remainingSeconds: null,
          endedAt: undefined,
        });
        await runJob(job);
      };
      void resetAndRun();
    },
    [runJob, updateItem],
  );

  const resolveConflict = useCallback(
    (id: string, resolution: UploadConflictResolution) => {
      const job = jobsRef.current.get(id);
      if (!job || job.running) return;
      if (resolution === "skip") {
        job.cancelled = true;
        updateItem(id, {
          status: "cancelled",
          error: "File skipped because of a name conflict",
          endedAt: Date.now(),
        });
        return;
      }
      job.autorename = resolution === "rename";
      job.cancelled = false;
      updateItem(id, { status: "waiting", error: undefined });
      void runJob(job);
    },
    [runJob, updateItem],
  );

  const clearCompleted = useCallback(() => {
    setUploads((current) =>
      current.filter(
        (item) =>
          isUploadActive(item.status) || item.status === "conflict",
      ),
    );
    for (const [id, job] of jobsRef.current) {
      const item = uploads.find((candidate) => candidate.id === id);
      if (item && isUploadTerminal(item.status)) jobsRef.current.delete(id);
      if (job.cancelled && !job.running) jobsRef.current.delete(id);
    }
  }, [uploads]);



  const settledWithoutErrors =
    uploads.length > 0 &&
    uploads.every(
      (item) => isUploadTerminal(item.status) && item.status !== "error",
    );
  useEffect(() => {
    if (!settledWithoutErrors) return;
    const timer = window.setTimeout(clearCompleted, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [clearCompleted, settledWithoutErrors]);

  return {
    uploads,
    handleUpload,
    handleUploadTree,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    resolveConflict,
    clearCompleted,
  };
}
