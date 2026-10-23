import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastItem {
  id: number;
  message: string;
}

export function useToast(duration = 2500) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string) => {
      const id = nextIdRef.current++;
      setToasts((current) => [...current, { id, message }]);

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, duration);
      timersRef.current.set(id, timer);
    },
    [duration],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return { message: toasts.at(-1)?.message ?? "", toasts, show, dismiss };
}
