import { useEffect, useRef, useState } from "react";

interface AnchorOptions {

  width: number;

  height: number;
}








export function usePopoverAnchor({ width, height }: AnchorOptions) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;

    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        anchorRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeFromViewportChange = () => setOpen(false);

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    window.addEventListener("resize", closeFromViewportChange);
    window.addEventListener("scroll", closeFromViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
      window.removeEventListener("resize", closeFromViewportChange);
      window.removeEventListener("scroll", closeFromViewportChange, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  const toggle = () => {
    if (!open) {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          top:
            rect.bottom + 8 + height <= window.innerHeight
              ? rect.bottom + 8
              : Math.max(8, rect.top - height - 8),
          left: Math.min(
            Math.max(8, rect.left),
            Math.max(8, window.innerWidth - width - 8),
          ),
        });
      }
    }
    setOpen((current) => !current);
  };


  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return { open, setOpen, position, anchorRef, menuRef, toggle, close, run };
}
