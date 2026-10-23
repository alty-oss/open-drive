import { useCallback, useState } from "react";
import type { FileItem } from "@/shared/files/types";
import type { ConfirmRequest } from "@/shared/ui/confirmTypes";

export type DashboardModalState =
  | { kind: "none" }
  | { kind: "preview"; file: FileItem; detailsOpen: boolean }
  | { kind: "editor"; file: FileItem; dirty: boolean }
  | { kind: "new-folder" }
  | { kind: "new-file" }
  | { kind: "rename"; item: FileItem }
  | { kind: "move"; item: FileItem }
  | { kind: "access"; item: FileItem }
  | { kind: "confirm"; confirm: ConfirmRequest };

export function useDashboardModal() {
  const [modal, setModal] = useState<DashboardModalState>({ kind: "none" });

  const closeModal = useCallback(() => setModal({ kind: "none" }), []);
  const openPreview = useCallback((file: FileItem) => {
    setModal((current) => ({
      kind: "preview",
      file,
      detailsOpen: current.kind === "preview" && current.detailsOpen,
    }));
  }, []);
  const openEditor = useCallback(
    (file: FileItem) => setModal({ kind: "editor", file, dirty: false }),
    [],
  );
  const openDetails = useCallback(
    (file: FileItem) =>
      setModal({ kind: "preview", file, detailsOpen: true }),
    [],
  );
  const togglePreviewDetails = useCallback(() => {
    setModal((current) =>
      current.kind === "preview"
        ? { ...current, detailsOpen: !current.detailsOpen }
        : current,
    );
  }, []);
  const setEditorDirty = useCallback((dirty: boolean) => {
    setModal((current) =>
      current.kind === "editor" && current.dirty !== dirty
        ? { ...current, dirty }
        : current,
    );
  }, []);
  const openNewFolder = useCallback(() => setModal({ kind: "new-folder" }), []);
  const openNewFile = useCallback(() => setModal({ kind: "new-file" }), []);
  const openRename = useCallback(
    (item: FileItem | null) =>
      setModal(item ? { kind: "rename", item } : { kind: "none" }),
    [],
  );
  const openMove = useCallback(
    (item: FileItem) => setModal({ kind: "move", item }),
    [],
  );
  const openAccess = useCallback(
    (item: FileItem) => setModal({ kind: "access", item }),
    [],
  );
  const openConfirm = useCallback(
    (confirm: ConfirmRequest) => setModal({ kind: "confirm", confirm }),
    [],
  );
  return {
    modal,
    closeModal,
    openPreview,
    openEditor,
    openDetails,
    togglePreviewDetails,
    setEditorDirty,
    openNewFolder,
    openNewFile,
    openRename,
    openMove,
    openAccess,
    openConfirm,
  };
}
