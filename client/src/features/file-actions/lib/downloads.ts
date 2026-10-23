import type { FileFilter } from "@/features/explorer";
import type { FileItem } from "@/shared/files/types";

export interface ArchiveDownloadRequest {
  action: string;
  parameter: "paths" | "ids";
  values: string[];
}

export function visibleItemsDownloadRequest(
  activeFilter: FileFilter,
  visibleFiles: FileItem[],
): ArchiveDownloadRequest | null {
  if (visibleFiles.length === 0) return null;
  const parameter = activeFilter === "trash" ? "ids" : "paths";
  return {
    action:
      activeFilter === "trash"
        ? "/api/download-trash-zip"
        : "/api/download-zip-batch",
    parameter,
    values: visibleFiles.map((item) => item.path),
  };
}

export function submitArchiveDownload({
  action,
  parameter,
  values,
}: ArchiveDownloadRequest) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.hidden = true;
  for (const value of values) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = parameter;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
}
