import type { ReactNode } from "react";

export interface ConfirmRequest {
  title: string;
  description: string | ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant: "danger" | "warning" | "default";
  onConfirm: () => void;
}
