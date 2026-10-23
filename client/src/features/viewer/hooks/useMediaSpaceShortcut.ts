import { useEffect, useRef } from "react";

const TEXT_ENTRY_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='textbox']",
].join(",");

export function useMediaSpaceShortcut(
  onToggle: () => void | Promise<void>,
  enabled = true,
) {
  const onToggleRef = useRef(onToggle);

  useEffect(() => {
    onToggleRef.current = onToggle;
  }, [onToggle]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isSpace = event.code === "Space" || event.key === " ";
      if (
        !isSpace ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(TEXT_ENTRY_SELECTOR)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void onToggleRef.current();
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      });
  }, [enabled]);
}
