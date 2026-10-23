import type { ToastItem } from "@/shared/hooks/useToast";

interface ToastProps {
  message?: string;
  toasts?: ToastItem[];
  onDismiss?: (id: number) => void;
}

export default function Toast({ message = "", toasts, onDismiss }: ToastProps) {
  const items = toasts ?? (message ? [{ id: 0, message }] : []);

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-600 flex -translate-x-1/2 flex-col-reverse items-center gap-2">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {items.at(-1)?.message ?? ""}
      </div>
      {items.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => onDismiss?.(toast.id)}
          className="pointer-events-auto max-w-[90vw] animate-slide-up rounded-lg border border-toast-border bg-toast px-4 py-2.5 text-center text-xs font-semibold text-toast-fg shadow-e3 transition-all duration-200"
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
