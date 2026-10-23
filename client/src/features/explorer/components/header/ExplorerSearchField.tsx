import type { Ref } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/shared/ui/cn";

export const searchField =
  "inline-flex h-12 items-center gap-3 rounded-full border border-border-subtle bg-surface-high px-4 " +
  "transition-[background-color,border-color,box-shadow] duration-150 " +
  "hover:bg-surface-highest focus-within:border-accent focus-within:bg-surface-highest focus-within:shadow-e2";

interface ExplorerSearchFieldProps {
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
  locationLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
}

export default function ExplorerSearchField({
  className,
  inputRef,
  locationLabel,
  search,
  onSearchChange,
}: ExplorerSearchFieldProps) {
  return (
    <div className={cn(searchField, className)}>
      <Search className="size-4 shrink-0 text-muted" />
      <input
        ref={inputRef}
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search all files"
        aria-label={`Global search; current location: ${locationLabel}`}
        className="h-full w-full min-w-0 rounded-none border-0 bg-transparent p-0 shadow-none focus:shadow-none"
      />
      {search ? (
        <button
          type="button"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted hover:bg-state-hover hover:text-text"
          aria-label="Clear search"
          onClick={() => onSearchChange("")}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
