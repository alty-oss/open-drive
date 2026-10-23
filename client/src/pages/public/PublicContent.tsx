import type { ReactNode } from "react";
import { HardDriveDownload } from "lucide-react";
import FileIcon from "@/shared/files/FileIcon";
import { getPreviewType } from "@/shared/files/fileTypes";
import { cn } from "@/shared/ui/cn";
import type { PublicItem } from "./types";

const previewCanvas =
  "flex min-h-88 flex-col items-center justify-center gap-3.5 rounded-md bg-canvas";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,color-mix(in_srgb,var(--accent)_12%,transparent),transparent_32rem),var(--app-bg)] p-3.5 text-text sm:p-5">
      <div className="mx-auto mb-5 flex w-[min(1080px,100%)] items-center gap-2.25 text-[0.9rem] font-semibold tracking-[-0.01em] [&>img]:size-8 [&>img]:rounded-sm [&>img]:object-cover">
        <img src="/brand-mark.png" alt="" />
        <span>OpenDrive</span>
      </div>
      {children}
    </main>
  );
}

export function PublicPreview({
  item,
  contentUrl,
  textPreview,
}: {
  item: PublicItem;
  contentUrl: string;
  textPreview: string | null;
}) {
  const type = getPreviewType(item.name);
  if (type === "image") {
    return <img className="mx-auto block max-h-[68vh] w-full rounded-md bg-canvas object-contain" src={contentUrl} alt={item.name} />;
  }
  if (type === "video") {

    return <video className="mx-auto block max-h-[68vh] w-full rounded-md bg-canvas object-contain" src={contentUrl} controls />;
  }
  if (type === "audio") {
    return (
      <div className={cn(previewCanvas, "[&>audio]:w-[min(34rem,90%)]")}>
        <FileIcon name={item.name} size="lg" />
        <audio src={contentUrl} controls />
      </div>
    );
  }
  if (type === "pdf") {
    return <iframe className="min-h-[68vh] w-full rounded-md border-0 bg-canvas" src={contentUrl} title={item.name} />;
  }
  if (textPreview !== null) {
    return <pre className="m-0 max-h-[68vh] overflow-auto rounded-md bg-canvas p-4 font-mono text-[0.76rem]/[1.6] whitespace-pre-wrap text-text">{textPreview}</pre>;
  }
  return (
    <div className={cn(previewCanvas, "[&>svg]:size-12 [&>svg]:text-accent [&>strong]:text-base [&>span]:text-xs [&>span]:text-muted")}>
      <HardDriveDownload />
      <strong>{item.name}</strong>
      <span>Preview is not available for this format.</span>
    </div>
  );
}
