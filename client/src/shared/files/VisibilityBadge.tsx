import { Globe2, LockKeyhole } from "lucide-react";
import { cn } from "@/shared/ui/cn";

interface VisibilityBadgeProps {
  visibility?: "public" | "private";
  source?: "explicit" | "inherited" | "default";
  compact?: boolean;
}

export default function VisibilityBadge({
  visibility = "private",
  source,
  compact = false,
}: VisibilityBadgeProps) {
  const isPublic = visibility === "public";
  const label = isPublic ? "Public" : "Private";
  const title =
    source === "inherited"
      ? `${label} by the folder setting`
      : source === "default"
        ? "Private by default"
        : label;
  const Icon = isPublic ? Globe2 : LockKeyhole;

  return (
    <span
      className={cn(
        "inline-flex min-h-5.5 flex-none items-center gap-1.25 rounded-md border",
        "border-border px-1.75 py-0.5 text-11 leading-none font-medium [&>svg]:size-3",
        isPublic
          ? "border-border-success bg-success-soft text-success"
          : "border-border-subtle bg-surface-alt text-muted-strong",
        compact &&
          "size-4.5 min-h-4.5 justify-center rounded-xs p-0 [&>svg]:size-2.75",
      )}
      title={title}
      aria-label={title}
    >
      <Icon aria-hidden="true" />
      {!compact ? <span>{label}</span> : null}
    </span>
  );
}
