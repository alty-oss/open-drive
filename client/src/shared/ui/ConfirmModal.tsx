import { type ReactNode } from "react";
import { AlertTriangle, Copy, Trash2 } from "lucide-react";
import ModalOverlay from "./ModalOverlay";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import {
  ALERT_ICON_VARIANT,
  dialogActions,
  dialogHeadingIcon,
} from "@/shared/ui/dialogStyles";

interface ConfirmModalProps {
  heading: string;
  description: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

const icons = {
  danger: <Trash2 className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  default: <Copy className="w-4 h-4" />,
};

export default function ConfirmModal({
  heading,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <ModalOverlay
      onClose={onCancel}
      ariaLabelledBy="confirm-dialog-title"
      ariaDescribedBy="confirm-dialog-description"
    >
      <div className="flex items-start gap-3">
        <div className={cn(dialogHeadingIcon, ALERT_ICON_VARIANT[variant])}>
          {icons[variant]}
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="confirm-dialog-title"
            className="text-sm font-semibold text-text"
          >
            {heading}
          </h2>
          <div
            id="confirm-dialog-description"
            className="mt-1.5 text-xs leading-relaxed text-muted"
          >
            {description}
          </div>
        </div>
      </div>

      <div className={dialogActions}>
        <button
          type="button"
          onClick={onCancel}
          className={cn(btn.outlined, "h-9 px-4 text-sm")}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            variant === "danger" ? btn.danger : btn.primary,
            "h-9 px-4 text-sm font-semibold",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalOverlay>
  );
}
