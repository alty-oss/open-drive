import { clientIdHeaders } from "@/shared/api/clientId";
import type { UploadJob } from "../model/uploadJob";
import { xhrError } from "./uploadApi";

export type TransferResult =
  | { kind: "ok" }
  | { kind: "paused" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

interface TransferInput {
  job: UploadJob;
  url: string;
  form: FormData;
  baseBytes: number;
  headers?: Record<string, string>;
  onProgress: (job: UploadJob, bytesTransferred: number) => void;
}

export function transferWithXhr({
  job,
  url,
  form,
  baseBytes,
  headers,
  onProgress,
}: TransferInput): Promise<TransferResult> {
  return new Promise((resolve) => {
    if (job.speed === 0) {
      job.sampleAt = performance.now();
      job.sampleBytes = baseBytes;
    }
    const xhr = new XMLHttpRequest();
    job.xhr = xhr;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(job, baseBytes + event.loaded);
      }
    };
    xhr.onload = () => {
      job.xhr = null;
      resolve(
        xhr.status >= 200 && xhr.status < 300
          ? { kind: "ok" }
          : {
              kind: "error",
              message: xhrError(xhr, "The server rejected the upload"),
            },
      );
    };
    xhr.onerror = () => {
      job.xhr = null;
      resolve({ kind: "error", message: "Network error during upload" });
    };
    xhr.onabort = () => {
      job.xhr = null;
      resolve(
        job.cancelled
          ? { kind: "cancelled" }
          : job.paused
            ? { kind: "paused" }
            : { kind: "error", message: "The upload was interrupted" },
      );
    };
    xhr.open("POST", url);
    for (const [name, value] of Object.entries({
      ...clientIdHeaders(),
      ...headers,
    })) {
      xhr.setRequestHeader(name, value);
    }
    xhr.send(form);
  });
}
