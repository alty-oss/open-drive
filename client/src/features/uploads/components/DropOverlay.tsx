import { UploadCloud } from "lucide-react";

interface DropOverlayProps {
  visible: boolean;
}

export default function DropOverlay({ visible }: DropOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-dashed border-accent bg-surface px-10 py-12 text-center shadow-e5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <UploadCloud className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-sm font-semibold text-text">
          Drop files to upload
        </p>
        <p className="mt-1 text-xs text-muted">
          Folders keep their structure
        </p>
      </div>
    </div>
  );
}
