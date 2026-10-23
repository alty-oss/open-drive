import type { ReactNode } from "react";
import { FileDown, FolderArchive, HardDriveDownload } from "lucide-react";
import FileIcon from "@/shared/files/FileIcon";
import { getPreviewType } from "@/shared/files/fileTypes";
import { cn } from "@/shared/ui/cn";
import type { PublicItem } from "./types";
import * as dv from "./styles";

export function DownloadStatusShell({ children }: { children: ReactNode }) {
  return (
    <main className={dv.statusPage} data-theme="dark">
      <header className={dv.statusHeader}>
        <img src="/brand-mark.png" alt="" />
        <span>OpenDrive</span>
      </header>
      <div className={dv.statusBody}>{children}</div>
    </main>
  );
}

export function DownloadPreview({
  item,
  contentUrl,
  textPreview,
  zoom,
}: {
  item: PublicItem;
  contentUrl: string;
  textPreview: string | null;
  zoom: number;
}) {
  if (item.isFolder) {
    return (
      <div className={dv.placeholder}>
        <FolderArchive />
        <strong>{item.name}</strong>
        <span>The folder will be compressed into a ZIP when the download starts.</span>
      </div>
    );
  }

  const type = getPreviewType(item.name);
  if (type === "image") {
    return (
      <div
        className={dv.imageZoom}
        style={{ width: `${Math.max(zoom, 100)}%` }}
      >
        <img
          className={cn(dv.media, dv.mediaZoomable)}
          src={contentUrl}
          alt={item.name}
          style={{ transform: `scale(${zoom / 100})` }}
        />
      </div>
    );
  }
  if (type === "video") {

    return <video className={cn(dv.media, dv.videoMedia)} src={contentUrl} controls />;
  }
  if (type === "audio") {
    return (
      <div className={cn(dv.placeholder, dv.audioPlaceholder)}>
        <FileIcon name={item.name} size="lg" />
        <strong>{item.name}</strong>
        <audio src={contentUrl} controls />
      </div>
    );
  }
  if (type === "pdf") {
    return <iframe className={dv.pdfFrame} src={contentUrl} title={item.name} />;
  }
  if (textPreview !== null) {
    return <pre className={dv.textPreview}>{textPreview}</pre>;
  }
  return (
    <div className={dv.placeholder}>
      {type === "unknown" ? <FileDown /> : <HardDriveDownload />}
      <strong>{item.name}</strong>
      <span>This format has no preview.</span>
    </div>
  );
}
