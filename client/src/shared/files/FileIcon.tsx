import { getMaterialFileIcon } from "./materialFileIcons";
import { cn } from "@/shared/ui/cn";

type IconSize = "xs" | "sm" | "md" | "lg";




const ICON_SIZE = {
  xs: "size-4.5 [&>img]:size-4.5",
  sm: "size-8 [&>img]:size-6.25",
  md: "size-10.5 [&>img]:size-8.5",
  lg: "size-19 [&>img]:size-15",
} as const satisfies Record<IconSize, string>;

interface FileIconProps {
  name: string;
  isFolder?: boolean;
  size?: IconSize;
}

export default function FileIcon({
  name,
  isFolder = false,
  size = "md",
}: FileIconProps) {
  const icon = getMaterialFileIcon(name, isFolder);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        "[&>img]:block [&>img]:max-h-full [&>img]:max-w-full [&>img]:object-contain",
        ICON_SIZE[size],
      )}
      data-drag-icon
      aria-hidden="true"
    >
      <img src={icon} alt="" draggable={false} />
    </span>
  );
}
