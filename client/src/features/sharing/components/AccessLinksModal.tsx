import { Copy, Loader2, X } from "lucide-react";
import type { FileItem } from "@/shared/files/types";
import { publicFileUrl } from "@/shared/files/urls";
import ModalOverlay from "@/shared/ui/ModalOverlay";
import { cn } from "@/shared/ui/cn";
import { btn, scrollGutter } from "@/shared/ui/styles";
import { useAccessLinks } from "../hooks/useAccessLinks";
import { absoluteUrl, copyText } from "../lib/shareLinks";
import {
  copyButton,
  doneButton,
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
  modalSubtitle,
  modalTitle,
} from "../styles";
import {
  AccessLinksList,
  CreateAccessLinkSection,
  GeneralAccessSection,
} from "./AccessSections";

interface AccessLinksModalProps {
  item: FileItem;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onToast: (message: string) => void;
}

export default function AccessLinksModal({
  item,
  onClose,
  onChanged,
  onToast,
}: AccessLinksModalProps) {
  const controller = useAccessLinks({ item, onChanged, onToast });
  const publicUrl = absoluteUrl(publicFileUrl(item));
  const copyPublicUrl = () => {
    void copyText(publicUrl).then(() => onToast("Public link copied"));
  };

  return (
    <ModalOverlay
      onClose={onClose}
      ariaLabel={`Access and links for ${item.name}`}
      className={modalShell}
    >
      <header className={modalHeader}>
        <div className="min-w-0">
          <h2 className={modalTitle}>Compartilhar</h2>
          <p className={modalSubtitle} title={item.path}>
            {item.name}
          </p>
        </div>
        <button
          type="button"
          className={btn.icon}
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </button>
      </header>

      <div className={cn(modalBody, scrollGutter)}>
        {controller.loading ? (
          <div className="flex min-h-80 items-center justify-center gap-2 text-13 text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading access settings...
          </div>
        ) : (
          <>
            {controller.error ? (
              <div
                className="mb-4 rounded-md bg-danger-soft px-3 py-2.5 text-13 text-danger"
                role="alert"
              >
                {controller.error}
              </div>
            ) : null}
            <GeneralAccessSection
              access={controller.access}
              saving={controller.savingAccess}
              publicUrl={publicUrl}
              onUpdate={controller.updateVisibility}
              onReset={controller.resetVisibility}
              onToast={onToast}
            />
            <CreateAccessLinkSection
              creating={controller.creatingLink}
              onCreate={controller.createLink}
              onError={controller.setError}
              onToast={onToast}
            />
            <AccessLinksList
              links={controller.links}
              onRevoke={controller.revokeLink}
              onToast={onToast}
            />
          </>
        )}
      </div>

      <footer className={modalFooter}>
        {controller.access.visibility === "public" ? (
          <button type="button" className={copyButton} onClick={copyPublicUrl}>
            <Copy />
            Copy link
          </button>
        ) : (
          <span className="text-11 text-muted">Item restrito</span>
        )}
        <button type="button" className={doneButton} onClick={onClose}>
          Completed
        </button>
      </footer>
    </ModalOverlay>
  );
}
