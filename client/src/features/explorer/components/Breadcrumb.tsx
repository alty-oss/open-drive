import { useState } from "react";
import { ChevronRight, HardDrive } from "lucide-react";
import { cn } from "@/shared/ui/cn";

const crumbButton =
  "inline-flex h-7 cursor-pointer items-center rounded-md border-none px-1.5 leading-none " +
  "transition-colors hover:bg-state-hover focus-visible:bg-state-hover focus-visible:outline-none";

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onNavigateInNewTab?: (path: string) => void;
  onMove: (itemPath: string, folderPath: string) => void;
}

export default function Breadcrumb({
  currentPath,
  onNavigate,
  onNavigateInNewTab,
  onMove,
}: BreadcrumbProps) {
  const parts = currentPath ? currentPath.split("/").filter(Boolean) : [];
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const visibleParts =
    parts.length <= 4
      ? parts.map((part, index) => ({ type: "part" as const, part, index }))
      : [
          { type: "part" as const, part: parts[0], index: 0 },
          { type: "ellipsis" as const, key: "middle" },
          {
            type: "part" as const,
            part: parts[parts.length - 2],
            index: parts.length - 2,
          },
          {
            type: "part" as const,
            part: parts[parts.length - 1],
            index: parts.length - 1,
          },
        ];

  const handleDragOver = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(path);
  };

  const handleDragLeave = () => setDropTarget(null);

  const handleDrop = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const itemPath = e.dataTransfer.getData("text/plain");
    if (itemPath && onMove) onMove(itemPath, folderPath);
  };

  return (
    <div className="flex h-7.5 min-w-0 items-center gap-0 overflow-hidden text-13 leading-none font-medium text-text">
      <button
        onClick={() => onNavigate("")}
        onMouseDown={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
        onAuxClick={(e) => {
          if (e.button !== 1) return;
          e.preventDefault();
          (onNavigateInNewTab ?? onNavigate)("");
        }}
        onDragOver={(e) => handleDragOver(e, "")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "")}
        className={cn(
          crumbButton,
          "min-w-0 shrink-0 gap-1.5 text-muted",
          dropTarget === "" ? "bg-state-selected" : "bg-transparent",
          parts.length === 0 ? "font-semibold" : "font-medium",
        )}
        aria-current={parts.length === 0 ? "page" : undefined}
      >
        <HardDrive className="w-3.5 h-3.5" />
        <span className="truncate">My Drive</span>
      </button>
      {visibleParts.map((item) => {
        if (item.type === "ellipsis") {
          return (
            <span
              key={item.key}
              className="inline-flex min-w-0 shrink-0 items-center text-muted"
            >
              <ChevronRight className="mx-0.5 size-3.25 shrink-0 text-muted" />
              <span className="inline-flex h-7 items-center px-1.5">...</span>
            </span>
          );
        }

        const pathUpTo = parts.slice(0, item.index + 1).join("/");
        const isLast = item.index === parts.length - 1;
        return (
          <span
            key={pathUpTo}
            className="inline-flex min-w-0 shrink-0 items-center"
          >
            <ChevronRight className="mx-0.5 size-3.25 shrink-0 text-muted" />
            <button
              onClick={() => onNavigate(pathUpTo)}
              onMouseDown={(e) => {
                if (e.button === 1) e.preventDefault();
              }}
              onAuxClick={(e) => {
                if (e.button !== 1) return;
                e.preventDefault();
                (onNavigateInNewTab ?? onNavigate)(pathUpTo);
              }}
              onDragOver={(e) => handleDragOver(e, pathUpTo)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, pathUpTo)}
              className={cn(
                crumbButton,
                "max-w-32 truncate md:max-w-48",
                dropTarget === pathUpTo ? "bg-state-selected" : "bg-transparent",
                isLast ? "font-semibold text-text" : "font-medium text-muted",
              )}
              aria-current={isLast ? "page" : undefined}
            >
              {item.part}
            </button>
          </span>
        );
      })}
    </div>
  );
}
