import { useCallback, useEffect, useRef } from "react";







export function useCoalescedCallback(
  callback: () => unknown,
  waitMs: number,
): () => void {
  const callbackRef = useRef(callback);
  const runningRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const run = useCallback(async function execute() {
    runningRef.current = true;
    pendingRef.current = false;
    try {
      await callbackRef.current();
    } finally {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        runningRef.current = false;
        if (pendingRef.current && mountedRef.current) void execute();
      }, waitMs);
    }
  }, [waitMs]);

  return useCallback(() => {
    if (runningRef.current) {
      pendingRef.current = true;
      return;
    }
    void run();
  }, [run]);
}
