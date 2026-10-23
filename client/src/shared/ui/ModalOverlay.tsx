import type { ReactNode } from "react";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { useEscapeKey } from "@/shared/hooks/useEscapeKey";
import { cn } from "@/shared/ui/cn";
import { surface, z } from "@/shared/ui/styles";

interface ModalOverlayProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;





  backdropClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

export default function ModalOverlay({
  children,
  onClose,
  className = "max-w-md p-5",
  backdropClassName,
  ariaLabel = "Janela",
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalOverlayProps) {
  const focusTrap = useFocusTrap<HTMLDivElement>();
  useEscapeKey(() => onClose?.());

  return (
    <div
      className={cn(
        "animate-fade-in fixed inset-0 flex items-center justify-center bg-black/40 p-4",
        z.overlay,
        backdropClassName,
      )}
    >
      {onClose ? (
        <button
          type="button"
          aria-label="Close window"
          className="absolute inset-0 cursor-default border-0 bg-transparent"
          onClick={onClose}
        />
      ) : null}
      <div
        ref={focusTrap.ref}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={cn(
          surface.card,
          "animate-fade-in relative w-full text-text focus-visible:outline-none",
          className,
        )}
        onKeyDown={focusTrap.onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
