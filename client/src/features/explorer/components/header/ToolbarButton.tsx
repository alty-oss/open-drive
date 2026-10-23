import type { ReactNode } from "react";
import { cn } from "@/shared/ui/cn";

export const commandButton =
  "inline-flex h-10 flex-none cursor-pointer items-center justify-center gap-2 " +
  "rounded-full border-0 text-13 font-medium " +
  "transition-colors duration-150";





const labeled = "bg-surface-high text-text hover:bg-surface-highest";






const ghost = "bg-transparent text-muted hover:bg-state-hover hover:text-text";






const responsiveLabel = "inline md:hidden xl:inline";
const responsiveWidth = "w-auto px-4 md:w-10 md:px-0 xl:w-auto xl:px-4";

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  danger?: boolean;

  iconOnly?: boolean;
  className?: string;
  children: ReactNode;
}

export default function ToolbarButton({
  label,
  onClick,
  danger,
  iconOnly = false,
  className,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        commandButton,
        "[&>svg]:size-4",
        iconOnly
          ?
            cn(ghost, "tooltip-anchor relative w-10 px-0")
          : cn(labeled, responsiveWidth),
        danger && "text-danger hover:bg-danger-soft hover:text-danger",
        className,
      )}
      aria-label={label}
      data-tooltip={iconOnly ? label : undefined}
      onClick={onClick}
    >
      {children}
      {!iconOnly ? <span className={responsiveLabel}>{label}</span> : null}
    </button>
  );
}
