import { useCallback } from "react";
import type { FileItem } from "@/shared/files/types";
import type { ConfirmRequest } from "@/shared/ui/confirmTypes";
import type { PostJson } from "@/shared/api/useMutation";

interface UseTrashActionsOptions {
  selected: Set<string>;
  clearSelection: () => void;
  refreshAll: () => void | Promise<void>;
  showToast: (message: string) => void;
  openConfirm: (confirm: ConfirmRequest) => void;
  closeModal: () => void;
  postJson: PostJson;
}

export function useTrashActions({
  selected,
  clearSelection,
  refreshAll,
  showToast,
  openConfirm,
  closeModal,
  postJson,
}: UseTrashActionsOptions) {
  const handleRestoreTrash = useCallback(
    async (item: FileItem) => {
      const result = await postJson<{ renamed?: boolean }>(
        "/api/trash/restore",
        { id: item.path },
        "Connection error while restoring item",
      );
      if (result.ok) {
        await refreshAll();
        showToast(
          result.data?.renamed
            ? "Item restored with a new name"
            : "Item restored",
        );
      }
    },
    [postJson, refreshAll, showToast],
  );

  const handlePermanentDelete = useCallback(
    (item: FileItem) => {
      openConfirm({
        title: "Delete from trash",
        description: `Delete "${item.name}" from the trash? This action cannot be undone.`,
        confirmLabel: "Delete from trash",
        variant: "danger",
        onConfirm: async () => {
          closeModal();
          const result = await postJson<{ deleted: number }>(
            "/api/trash/delete",
            { id: item.path },
            "Connection error while deleting from the trash",
          );
          if (result.ok) {
            await refreshAll();
            showToast("Item deleted from the trash");
          }
        },
      });
    },
    [closeModal, openConfirm, postJson, refreshAll, showToast],
  );

  const handleBatchPermanentDelete = useCallback(() => {
    const count = selected.size;
    openConfirm({
      title: `Delete ${count} ${count === 1 ? "item" : "items"} from trash`,
      description: "This action cannot be undone.",
      confirmLabel: "Delete from trash",
      variant: "danger",
      onConfirm: async () => {
        closeModal();
        const ids = Array.from(selected);
        const result = await postJson<{ deleted: number }>(
          "/api/trash/delete",
          { ids },
          "Connection error while deleting from the trash",
        );
        if (result.ok) {
          clearSelection();
          await refreshAll();
          const deleted = result.data?.deleted ?? ids.length;
          showToast(
            `${deleted} ${deleted === 1 ? "item deleted" : "items deleted"} from the trash`,
          );
        }
      },
    });
  }, [
    clearSelection,
    closeModal,
    openConfirm,
    postJson,
    refreshAll,
    selected,
    showToast,
  ]);

  const handleEmptyTrash = useCallback(() => {
    openConfirm({
      title: "Empty trash",
      description: "Delete all items from the trash? This action cannot be undone.",
      confirmLabel: "Esemptyr",
      variant: "danger",
      onConfirm: async () => {
        closeModal();
        const result = await postJson<{ deleted: number }>(
          "/api/trash/empty",
          {},
          "Connection error while emptying the trash",
        );
        if (result.ok) {
          clearSelection();
          await refreshAll();
          showToast("Trash emptied");
        }
      },
    });
  }, [
    clearSelection,
    closeModal,
    openConfirm,
    postJson,
    refreshAll,
    showToast,
  ]);

  return {
    handleRestoreTrash,
    handlePermanentDelete,
    handleBatchPermanentDelete,
    handleEmptyTrash,
  };
}
