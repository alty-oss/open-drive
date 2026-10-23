import { useEffect, useState } from "react";
import {
  AlertCircle,
  Download,
  File,
  Folder,
  FolderOpen,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import FileIcon from "@/shared/files/FileIcon";
import { getPreviewType } from "@/shared/files/fileTypes";
import { encodePath } from "@/shared/files/urls";
import { formatDate, formatSize } from "@/shared/lib/format";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import { loadPublicPath, loadPublicText } from "./api";
import type { PublicItem, PublicPayload } from "./types";
import { PublicPreview, PublicShell } from "./PublicContent";

const publicCard = "rounded-lg bg-surface-alt";
const eyebrow =
  "m-0 mb-1.5 flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-[0.08em] " +
  "text-accent uppercase [&>svg]:size-3.5";

export default function PublicAccess({ value }: { value: string }) {
  const [data, setData] = useState<PublicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [textPreview, setTextPreview] = useState<string | null>(null);

  const contentUrl = `/f/${encodePath(value)}`;
  const downloadUrl = `/api/public-path-download/${encodePath(value)}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setData(null);
    setTextPreview(null);
    loadPublicPath(value, controller.signal)
      .then((payload) => {
        setData(payload);
        document.title = `${payload.item.name} — OpenDrive`;
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [value]);

  useEffect(() => {
    if (!data || data.item.isFolder || data.item.size > 2 * 1024 * 1024) return;
    const previewType = getPreviewType(data.item.name);
    if (previewType !== "text" && previewType !== "markdown") return;
    const controller = new AbortController();
    loadPublicText(contentUrl, controller.signal)
      .then(setTextPreview)
      .catch(() => undefined);
    return () => controller.abort();
  }, [contentUrl, data]);

  const openChild = (item: PublicItem) => {
    const fullPath = [value, item.path].filter(Boolean).join("/");
    location.href = item.isFolder
      ? `/public/${encodePath(fullPath)}`
      : `/f/${encodePath(fullPath)}`;
  };

  if (loading) {
    return (
      <PublicShell>
        <div className="flex min-h-[60vh] items-center justify-center gap-2.25 text-[0.8rem] text-muted [&>svg]:size-4">
          <Loader2 className="animate-spin" />
          Loading public content...
        </div>
      </PublicShell>
    );
  }

  if (error || !data) {
    return (
      <PublicShell>
        <section className={cn(publicCard, "m-auto w-[min(34rem,100%)] p-[clamp(1.5rem,5vw,2.5rem)] text-center [&>p:first-of-type]:justify-center")}>
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-lg bg-accent-soft text-accent [&>svg]:size-8">
            <AlertCircle />
          </div>
          <p className={eyebrow}>Content unavailable</p>
          <h1 className="m-0 text-[clamp(1.25rem,3vw,2rem)] font-semibold tracking-[-0.035em] text-text">
            Unable to open this item
          </h1>
          <p className="mt-1.5 mb-0 text-[0.78rem] text-muted">
            The file may be private or may have been removed.
          </p>
        </section>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto grid w-[min(1080px,100%)] gap-3.5">
        <header className={cn(publicCard, "flex flex-col items-stretch gap-6 p-5.5 sm:flex-row sm:items-center sm:justify-between")}>
          <div>
            <p className={eyebrow}>
              <ShieldCheck />
              Public content
            </p>
            <h1 className="m-0 text-[clamp(1.25rem,3vw,2rem)] font-semibold tracking-[-0.035em] text-text">
              {data.item.name}
            </h1>
            <p className="mt-1.5 mb-0 text-[0.78rem] text-muted">
              {data.item.isFolder
                ? `${data.children?.length ?? 0} items in this folder`
                : `${formatSize(data.item.size)} · Modified ${formatDate(
                    data.item.modifiedAt,
                  )}`}
            </p>
          </div>
          <a className={cn(btn.primary, "min-h-10.5 justify-center px-4 whitespace-nowrap sm:justify-start [&>svg]:size-3.75")} href={downloadUrl}>
            <Download />
            {data.item.isFolder ? "Download folder (.zip)" : "Download file"}
          </a>
        </header>

        <section className={cn(publicCard, "min-h-72 overflow-hidden p-4 sm:min-h-96")}>
          {data.item.isFolder ? (
            <>
              <div className="mb-3 flex items-center gap-3 border-b border-border-subtle px-1.5 pt-2 pb-4 [&>svg]:size-8 [&>svg]:text-accent [&_strong]:block [&_strong]:text-[0.88rem] [&_span]:mt-0.5 [&_span]:block [&_span]:text-[0.7rem] [&_span]:text-muted">
                <FolderOpen />
                <div>
                  <strong>{data.item.name}</strong>
                  <span>Select a folder or file</span>
                </div>
              </div>
              <div className="grid gap-1">
                {(data.children ?? []).map((item) => (
                  <button
                    type="button"
                    key={item.path}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.75 rounded-md border border-transparent bg-transparent px-2.75 py-2.5 text-left text-text not-disabled:hover:border-border not-disabled:hover:bg-state-hover [&>svg]:size-3.5 [&>svg]:text-muted [&_strong]:block [&_strong]:overflow-hidden [&_strong]:text-[0.78rem] [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_small]:mt-0.5 [&_small]:block [&_small]:text-[0.66rem] [&_small]:text-muted"
                    onClick={() => openChild(item)}
                  >
                    <FileIcon
                      name={item.name}
                      isFolder={item.isFolder}
                      size="sm"
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.isFolder ? "Folder" : formatSize(item.size)}</small>
                    </span>
                    {item.isFolder ? <Folder /> : <File />}
                  </button>
                ))}
                {!data.children?.length ? (
                  <div className="grid min-h-56 place-items-center text-[0.78rem] text-muted">This folder is empty.</div>
                ) : null}
              </div>
            </>
          ) : (
            <PublicPreview
              item={data.item}
              contentUrl={contentUrl}
              textPreview={textPreview}
            />
          )}
        </section>
      </div>
    </PublicShell>
  );
}
