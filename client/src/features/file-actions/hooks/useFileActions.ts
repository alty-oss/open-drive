import { useCallback } from "react";
import type { FileFilter } from "@/features/explorer";
import { encodePath, fileUrl, publicFileUrl } from "@/shared/files/urls";
import type { FileItem } from "@/shared/files/types";
import { useMutation } from "@/shared/api/useMutation";
import type { ConfirmRequest } from "@/shared/ui/confirmTypes";
import {
  submitArchiveDownload,
  visibleItemsDownloadRequest,
} from "../lib/downloads";
import { useTrashActions } from "./useTrashActions";

interface UseFileActionsOptions {
  currentPath: string;
  activeFilter: FileFilter;
  visibleFiles: FileItem[];
  selected: Set<string>;
  clearSelection: () => void;
  refreshFiles: () => void | Promise<void>;
  refreshAll: () => void | Promise<void>;

  removeItems: (paths: Iterable<string>) => void;
  showToast: (message: string) => void;
  openConfirm: (confirm: ConfirmRequest) => void;
  closeModal: () => void;
}

export function useFileActions({
  currentPath,
  activeFilter,
  visibleFiles,
  selected,
  clearSelection,
  refreshFiles,
  refreshAll,
  removeItems,
  showToast,
  openConfirm,
  closeModal,
}: UseFileActionsOptions) {
  const { request, postJson } = useMutation({ showToast });

  const handleDelete = useCallback(
    (item: FileItem) => {
      const label = item.isFolder
        ? "this folder and all of its contents"
        : "this file";
      openConfirm({
        title: item.isFolder ? "Delete folder" : "Delete file",
        description: `Are you sure you want to delete ${label}? The item will be moved to the trash.`,
        confirmLabel: "Delete",
        variant: "danger",
        onConfirm: async () => {
          closeModal();
          removeItems([item.path]);
          const result = await request(`/api/files/${encodePath(item.path)}`, {
            method: "DELETE",
            errorMessage: "Connection error while deleting item",
          });
          await refreshAll();
          if (result.ok) {
            showToast(item.isFolder ? "Folder deleted" : "File deleted");
          }
        },
      });
    },
    [closeModal, openConfirm, refreshAll, removeItems, request, showToast],
  );

  const handleCopy = useCallback(
    (item: FileItem) => {
      if (item.visibility !== "public") {
        showToast("The item is private. Create a share link.");
        return;
      }
      const url = `${location.origin}${publicFileUrl(item)}`;
      navigator.clipboard.writeText(url);
      showToast("Link copied!");
    },
    [showToast],
  );

  const handleToggleVisibility = useCallback(
    async (item: FileItem) => {
      const visibility =
        item.visibility === "public" ? "private" : "public";
      const result = await request("/api/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: item.path, visibility }),
        errorMessage: "Unable to change visibility",
      });
      if (!result.ok) return;
      await refreshAll();
      showToast(
        visibility === "public"
          ? "Item is now public"
          : "Item is now private",
      );
    },
    [refreshAll, request, showToast],
  );

  const handleDownload = useCallback((item: FileItem) => {
    const a = document.createElement("a");
    a.href = fileUrl(item);
    a.download = "";
    a.click();
  }, []);

  const handleMove = useCallback(
    async (itemPath: string, destFolder: string) => {


      removeItems([itemPath]);
      const result = await postJson(
        "/api/move",
        { from: itemPath, to: destFolder },
        "Connection error while moving item",
      );
      await refreshFiles();
      if (result.ok) showToast("Item moved");
    },
    [postJson, refreshFiles, removeItems, showToast],
  );

  const handlePasteItems = useCallback(
    async (paths: string[], mode: "copy" | "cut", destFolder: string) => {
      const result = await postJson<{ copied?: number; moved?: number }>(
        mode === "copy" ? "/api/copy-batch" : "/api/move-batch",
        { paths, to: destFolder },
        mode === "copy"
          ? "Connection error while copying items"
          : "Connection error while moving items",
      );
      if (!result.ok) return false;

      const count = mode === "copy" ? result.data?.copied : result.data?.moved;
      await refreshAll();
      showToast(
        `${count ?? paths.length} ${paths.length === 1 ? "item" : "items"} ${
          mode === "copy" ? "copied" : "moved"
        }`,
      );
      return true;
    },
    [postJson, refreshAll, showToast],
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      const result = await postJson(
        "/api/folders",
        { name, path: currentPath },
        "Connection error while creating folder",
      );
      if (result.ok) {
        await refreshAll();
        showToast("Folder created");
        return true;
      }
      return false;
    },
    [currentPath, postJson, refreshAll, showToast],
  );


  const handleCreateFile = useCallback(
    async (name: string): Promise<FileItem | null> => {
      const result = await postJson(
        "/api/new-file",
        { name, path: currentPath },
        "Connection error while creating file",
      );
      if (!result.ok) return null;
      await refreshAll();
      showToast("File created");
      const created = result.data as { name?: string; path?: string } | undefined;
      if (!created?.path) return null;
      return {
        path: created.path,
        name: created.name ?? name,
        isFolder: false,
        isImage: false,
        size: 0,
        date: new Date().toISOString(),
      };
    },
    [currentPath, postJson, refreshAll, showToast],
  );

  const handleRename = useCallback(
    async (item: FileItem, newName: string) => {
      const result = await postJson(
        "/api/rename",
        { from: item.path, newName },
        "Connection error while renaming",
      );
      if (result.ok) {
        await refreshFiles();
        showToast("Renamed successfully");
        return true;
      }
      return false;
    },
    [postJson, refreshFiles, showToast],
  );

  const handleBatchDelete = useCallback(() => {
    const count = selected.size;
    openConfirm({
      title: `Delete ${count} ${count === 1 ? "item" : "items"}`,
      description: `Are you sure you want to delete ${count} ${count === 1 ? "selected item" : "selected items"}? They will be moved to the trash.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        closeModal();
        const paths = Array.from(selected);
        removeItems(paths);
        const result = await postJson<{ deleted: number }>(
          "/api/delete-batch",
          { paths },
          "Connection error while deleting items",
        );
        if (!result.ok) {
          await refreshAll();
          return;
        }
        const deleted = result.data?.deleted ?? paths.length;
        clearSelection();
        await refreshAll();
        showToast(
          `${deleted} ${deleted === 1 ? "item deleted" : "items deleted"}`,
        );
      },
    });
  }, [
    clearSelection,
    closeModal,
    openConfirm,
    postJson,
    refreshAll,
    removeItems,
    selected,
    showToast,
  ]);

  const trash = useTrashActions({
    selected,
    clearSelection,
    refreshAll,
    showToast,
    openConfirm,
    closeModal,
    postJson,
  });

  const downloadSelected = useCallback(() => {
    submitArchiveDownload({
      action: "/api/download-zip-batch",
      parameter: "paths",
      values: Array.from(selected),
    });
  }, [selected]);

  const downloadAll = useCallback(() => {
    const request = visibleItemsDownloadRequest(activeFilter, visibleFiles);
    if (!request) {
      showToast("No visible items to download");
      return;
    }
    submitArchiveDownload(request);
  }, [activeFilter, showToast, visibleFiles]);

  return {
    handleDelete,
    handleCopy,
    handleToggleVisibility,
    handleDownload,
    handleMove,
    handlePasteItems,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleBatchDelete,
    ...trash,
    downloadSelected,
    downloadAll,
  };
}
