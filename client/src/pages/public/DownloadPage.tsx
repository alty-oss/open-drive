import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Download,
  Info,
  Loader2,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import FileIcon from "@/shared/files/FileIcon";
import ModalOverlay from "@/shared/ui/ModalOverlay";
import { getPreviewType } from "@/shared/files/fileTypes";
import { cn } from "@/shared/ui/cn";
import * as dv from "./styles";
import { formatDate, formatSize } from "@/shared/lib/format";
import { loadDownloadLink, loadPublicText } from "./api";
import type { DownloadPayload } from "./types";
import { DownloadPreview, DownloadStatusShell } from "./DownloadContent";

const CATEGORY_LABELS: Record<string, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
  archive: "Compressed file",
  code: "Code",
  other: "File",
  folder: "Folder",
};

const MIN_ZOOM = 25;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;

export default function DownloadPage({ token }: { token: string }) {
  const [data, setData] = useState<DownloadPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const tokenPath = encodeURIComponent(token);
  const contentUrl = `/api/public-links/${tokenPath}/content`;
  const downloadUrl = `/api/public-links/${tokenPath}/download`;

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setTextPreview(null);
    setZoom(100);
    setDetailsOpen(false);
    setLoading(true);
    setError(false);

    loadDownloadLink(token, controller.signal)
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
  }, [token]);

  useEffect(() => {
    if (!data || data.item.isFolder || data.item.size > 2 * 1024 * 1024) return;
    const type = getPreviewType(data.item.name);
    if (type !== "text" && type !== "markdown") return;

    const controller = new AbortController();
    loadPublicText(contentUrl, controller.signal)
      .then(setTextPreview)
      .catch(() => undefined);

    return () => controller.abort();
  }, [contentUrl, data]);

  const extension = useMemo(() => {
    const name = data?.item.name ?? "";
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toUpperCase() : "";
  }, [data]);

  if (loading) {
    return (
      <DownloadStatusShell>
        <Loader2 className="animate-spin" />
        <strong>Preparing the file</strong>
        <span>Validating the link and loading the preview.</span>
      </DownloadStatusShell>
    );
  }

  if (error || !data) {
    return (
      <DownloadStatusShell>
        <AlertCircle />
        <strong>Download unavailable</strong>
        <span>The link expired, was revoked, or the file no longer exists.</span>
      </DownloadStatusShell>
    );
  }

  const previewType = data.item.isFolder
    ? "folder"
    : getPreviewType(data.item.name);
  const canZoom = previewType === "image";
  const canPrint =
    previewType === "image" ||
    previewType === "pdf" ||
    previewType === "text" ||
    previewType === "markdown";
  const typeLabel = data.item.isFolder
    ? "Compressed folder"
    : CATEGORY_LABELS[data.item.category] ?? "File";
  const expiresLabel = data.expiresAt
    ? `Expires ${new Date(data.expiresAt).toLocaleString("en-US")}`
    : "Link does not expire";

  const changeZoom = (change: number) => {
    setZoom((current) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + change)),
    );
  };

  return (
    <main className={dv.page} data-theme="dark">
      <header className={dv.viewerHeader}>
        <div className={dv.viewerFile}>
          <div className={dv.viewerFileIcon}>
            <FileIcon
              name={data.item.name}
              isFolder={data.item.isFolder}
              size="md"
            />
          </div>
          <div className={dv.viewerFileCopy}>
            <h1 title={data.item.name}>{data.item.name}</h1>
            <div>
              <span>{typeLabel}</span>
              {!data.item.isFolder ? (
                <>
                  <i aria-hidden="true" />
                  <span>{formatSize(data.item.size)}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className={dv.viewerBrand} aria-label="OpenDrive">
          <img src="/brand-mark.png" alt="" />
          <span>OpenDrive</span>
        </div>
      </header>

      <nav className={dv.viewerToolbar} aria-label="File tools">
        <div className={dv.toolbarGroup}>
          <a
            className={cn(dv.tool, "md:pr-3.75")}
            href={downloadUrl}
            aria-label={
              data.item.isFolder ? "Download folder as ZIP" : "Download file"
            }
            title={data.item.isFolder ? "Download folder as ZIP" : "Download"}
          >
            <Download />
            <span className={dv.toolLabel}>Download</span>
          </a>




          {canPrint ? (
            <button
              className={dv.tool}
              type="button"
              onClick={() => window.print()}
              aria-label="Print"
              title="Print"
            >
              <Printer />
            </button>
          ) : null}

          {canZoom ? (
            <>
              <span className={dv.toolbarDivider} aria-hidden="true" />

              <button
                className={dv.tool}
                type="button"
                onClick={() => changeZoom(-ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              title="Zoom out"
              >
                <Minus />
              </button>
              <output className={dv.zoomOutput} aria-live="polite">
                {zoom}%
              </output>
              <button
                className={dv.tool}
                type="button"
                onClick={() => changeZoom(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Increase zoom"
                title="Increase zoom"
              >
                <Plus />
              </button>
              <button
                className={dv.tool}
                type="button"
                onClick={() => setZoom(100)}
                disabled={zoom === 100}
                aria-label="Reset zoom"
                title="Fit to screen"
              >
                <RotateCcw />
              </button>
            </>
          ) : null}
        </div>

        <button
          className={cn(dv.tool, "md:pr-4", detailsOpen && dv.toolActive)}
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          aria-controls="download-details"
        >
          <Info />
          <span className={dv.toolLabel}>Details</span>
        </button>
      </nav>

      <div className={dv.viewerBody}>
        <section
          className={dv.viewerCanvas}
          aria-label="File preview"
        >
          <DownloadPreview
            item={data.item}
            contentUrl={contentUrl}
            textPreview={textPreview}
            zoom={zoom}
          />
        </section>

      </div>

      {detailsOpen ? (
        <ModalOverlay
          onClose={() => setDetailsOpen(false)}
          ariaLabel="File details"
          className={dv.detailsModal}
        >
          <header className={dv.detailsHeader}>
            <strong>Details</strong>
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              aria-label="Close details"
              title="Close"
            >
              <X />
            </button>
          </header>

          <div className={dv.detailsBody}>
            <div className={dv.detailsFile}>
              <div className={dv.detailsFileIcon}>
                <FileIcon
                  name={data.item.name}
                  isFolder={data.item.isFolder}
                  size="lg"
                />
              </div>
              <strong>{data.item.name}</strong>
              <span>{typeLabel}</span>
            </div>

            <a className={dv.detailsAction} href={downloadUrl}>
              <Download />
              {data.item.isFolder ? "Download folder as ZIP" : "Download file"}
            </a>

            <div className={dv.detailsExpiration}>
              {data.expiresAt ? <CalendarDays /> : <ShieldCheck />}
              <span>{expiresLabel}</span>
            </div>

            <dl className={dv.detailsList}>
              <div>
                <dt>Type</dt>
                <dd>{extension || typeLabel}</dd>
              </div>
              {!data.item.isFolder ? (
                <div>
                    <dt>Size</dt>
                  <dd>{formatSize(data.item.size)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Modified</dt>
                <dd>{formatDate(data.item.modifiedAt)}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(data.item.createdAt)}</dd>
              </div>
            </dl>

            <p className={dv.detailsNote}>
              <ShieldCheck />
              The file is served directly by OpenDrive.
            </p>
          </div>
        </ModalOverlay>
      ) : null}
    </main>
  );
}
