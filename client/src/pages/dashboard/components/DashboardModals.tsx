import { lazy, Suspense } from "react";
import { Info, Loader2, X } from "lucide-react";
import type { FileItem } from "@/shared/files/types";
import type { DashboardModalState } from "../hooks/useDashboardModal";
import {
  MoveModal,
  NewFileModal,
  NewFolderModal,
  RenameModal,
} from "@/features/file-actions";
import { AccessLinksModal } from "@/features/sharing";
import ConfirmModal from "@/shared/ui/ConfirmModal";
import ModalOverlay from "@/shared/ui/ModalOverlay";
import { getPreviewType } from "@/shared/files/fileTypes";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";

const PreviewPane = lazy(() =>
  import("@/features/viewer").then((module) => ({ default: module.PreviewPane })),
);
const EditorPane = lazy(() =>
  import("@/features/viewer").then((module) => ({ default: module.EditorPane })),
);
const DetailsPane = lazy(() =>
  import("@/features/viewer").then((module) => ({ default: module.DetailsPane })),
);

interface DashboardModalsProps {
  modal: DashboardModalState;
  previewFiles: FileItem[];
  onClose: () => void;
  onRequestEditorClose: () => void;
  onEditorDirtyChange: (dirty: boolean) => void;
  onRename: (item: FileItem, newName: string) => void;
  onCreateFolder: (name: string) => void;
  onCreateFile: (name: string) => void;
  onMove: (itemPath: string, destFolder: string) => void | Promise<void>;
  onPreview: (file: FileItem) => void;
  onEdit: (file: FileItem) => void;
  onTogglePreviewDetails: () => void;
  onToast: (message: string) => void;
  currentPath: string;
  onAccessChanged: () => void | Promise<void>;
}

export default function DashboardModals({
  modal,
  previewFiles,
  onClose,
  onRequestEditorClose,
  onEditorDirtyChange,
  onRename,
  onCreateFolder,
  onCreateFile,
  onMove,
  onPreview,
  onEdit,
  onTogglePreviewDetails,
  onToast,
  currentPath,
  onAccessChanged,
}: DashboardModalsProps) {
  const previewType =
    modal.kind === "preview"
      ? modal.file.isFolder
        ? "unknown"
        : getPreviewType(modal.file.name)
      : null;

  return (
    <>
      {modal.kind === "preview" && (
        <ModalOverlay
          onClose={onClose}
          ariaLabel={`Preview of ${modal.file.name}`}


          backdropClassName="p-0 md:p-4"
          className={cn(
            "h-full max-h-none w-full overflow-hidden rounded-none border-0 p-0",
            "md:h-[min(900px,94vh)] md:max-h-[94vh] md:rounded-xl",
            modal.detailsOpen
              ? "md:w-[min(1420px,96vw)]"
              : "md:w-[min(1180px,94vw)]",
            previewType === "audio" &&
              !modal.detailsOpen &&
              "md:h-[min(540px,86vh)] md:w-[min(760px,92vw)]",
          )}
        >
          <div className="relative flex h-full min-h-0 w-full bg-surface">
            <div className="min-h-0 min-w-0 flex-1">
              <Suspense fallback={<ModalLoading />}>
                <PreviewPane
                  file={modal.file}
                  files={previewFiles}
                  onToast={onToast}
                  onOpenPreview={onPreview}
                  onEdit={onEdit}
                  onDetails={onTogglePreviewDetails}
                  onClose={onClose}
                />
              </Suspense>
            </div>
            {modal.detailsOpen ? (
              <aside
                className="flex min-h-0 w-82.5 flex-[0_0_330px] flex-col border-l border-border-subtle bg-surface-alt"
                aria-label="File details"
              >
                <div className="flex min-h-15 shrink-0 items-center justify-between gap-3 border-b border-border-subtle py-2.25 pr-3 pl-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <Info className="h-4 w-4 text-accent" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                        Information
                      </div>
                      <div className="truncate text-sm font-semibold text-text">
                        {modal.file.name}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onTogglePreviewDetails}
                    aria-label="Close details"
                    className={btn.icon}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <Suspense fallback={<ModalLoading />}>
                    <DetailsPane path={modal.file.path} name={modal.file.name} />
                  </Suspense>
                </div>
              </aside>
            ) : null}
          </div>
        </ModalOverlay>
      )}

      {modal.kind === "editor" && (
        <ModalOverlay
          onClose={onRequestEditorClose}
          ariaLabel={`Editor for ${modal.file.name}`}
          backdropClassName="p-0 md:p-4"
          className={cn(
            "h-full max-h-none w-full overflow-hidden rounded-none border-0 p-0",
            "md:h-[min(900px,94vh)] md:max-h-[94vh] md:max-w-[min(1220px,96vw)] md:rounded-xl",
          )}
        >
          <Suspense fallback={<ModalLoading />}>
            <EditorPane
              file={modal.file}
              onToast={onToast}
              onDirtyChange={onEditorDirtyChange}
              onPreview={onPreview}
              onClose={onRequestEditorClose}
            />
          </Suspense>
        </ModalOverlay>
      )}

      {modal.kind === "rename" && (
        <RenameModal
          currentName={modal.item.name}
          onClose={onClose}
          onRename={(newName) => onRename(modal.item, newName)}
        />
      )}

      {modal.kind === "new-folder" && (
        <NewFolderModal onClose={onClose} onCreate={onCreateFolder} />
      )}

      {modal.kind === "new-file" && (
        <NewFileModal onClose={onClose} onCreate={onCreateFile} />
      )}

      {modal.kind === "move" && (
        <MoveModal
          item={modal.item}
          currentPath={currentPath}
          onClose={onClose}
          onMove={onMove}
        />
      )}

      {modal.kind === "access" && (
        <AccessLinksModal
          item={modal.item}
          onClose={onClose}
          onChanged={onAccessChanged}
          onToast={onToast}
        />
      )}

      {modal.kind === "confirm" && (
        <ConfirmModal
          heading={modal.confirm.title}
          description={modal.confirm.description}
          confirmLabel={modal.confirm.confirmLabel}
          cancelLabel={modal.confirm.cancelLabel}
          variant={modal.confirm.variant}
          onConfirm={modal.confirm.onConfirm}
          onCancel={onClose}
        />
      )}
    </>
  );
}

function ModalLoading() {
  return (
    <div className="flex h-full min-h-60 items-center justify-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading...
    </div>
  );
}
