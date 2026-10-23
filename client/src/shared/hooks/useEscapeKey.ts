import { useEffect } from "react";

const escapeStack: symbol[] = [];

export function useEscapeKey(callback: () => void) {
  useEffect(() => {
    const token = Symbol("escape-listener");
    escapeStack.push(token);

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (escapeStack.at(-1) !== token) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      callback();
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => {
      document.removeEventListener("keydown", handler, { capture: true });
      const index = escapeStack.indexOf(token);
      if (index !== -1) escapeStack.splice(index, 1);
    };
  }, [callback]);
}
