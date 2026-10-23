import type { KeyboardEventHandler, ReactNode, Ref } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/ui/cn";
import { surface, z } from "@/shared/ui/styles";

export const menuItem =
  "flex h-11 w-full cursor-pointer items-center gap-3 rounded-full border-0 " +
  "bg-transparent px-3 text-13 text-text hover:bg-surface-highest [&>svg]:size-4.5 [&>svg]:text-muted";

export const menuItemDanger = "text-danger hover:bg-danger-soft";

interface AnchoredMenuProps {
  menuRef: Ref<HTMLDivElement>;
  label: string;
  position: { top: number; left: number };
  width: number;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  children: ReactNode;
}





export default function AnchoredMenu({
  menuRef,
  label,
  position,
  width,
  onKeyDown,
  children,
}: AnchoredMenuProps) {
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      aria-orientation="vertical"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(surface.popover, "fixed", z.popover)}
      style={{ ...position, width }}
    >
      {children}
    </div>,
    document.body,
  );
}
