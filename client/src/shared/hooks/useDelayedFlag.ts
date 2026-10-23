import { useEffect, useState } from "react";





export function useDelayedFlag(active: boolean, delayMs: number) {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!active) {
      setDelayed(false);
      return;
    }
    const timer = window.setTimeout(() => setDelayed(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return active && delayed;
}
