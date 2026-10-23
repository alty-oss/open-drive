import { cn } from "@/shared/ui/cn";
import { scrollGutter } from "@/shared/ui/styles";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { formatDate, formatSize } from "@/shared/lib/format";
import { logClientError } from "@/shared/lib/logger";
import type { FileMetadata } from "@/shared/files/types";
import VisibilityBadge from "@/shared/files/VisibilityBadge";
import { fetchFileMetadata } from "../api/viewerApi";

interface DetailsPaneProps {
  path: string;
  name: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

function formatBitrate(bitsPerSecond: number): string {
  return bitsPerSecond >= 1_000_000
    ? `${(bitsPerSecond / 1_000_000).toFixed(2)} Mbps`
    : `${Math.round(bitsPerSecond / 1000)} kbps`;
}

export default function DetailsPane({ path, name }: DetailsPaneProps) {
  const [data, setData] = useState<FileMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);

    (async () => {
      try {
        const parsed = await fetchFileMetadata(path);
        if (active) setData(parsed);
      } catch (caught) {
        if (!active) return;
        logClientError("metadata.fetch_failed", caught, { path });
        setError("Unable to read the details for this file");
      }
    })();

    return () => {
      active = false;
    };
  }, [path]);

  if (error) return <div className="p-4 text-sm text-muted">{error}</div>;

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        Reading details...
      </div>
    );
  }

  const hasPhoto = Boolean(
    data.takenAt || data.camera || data.lens || data.iso || data.aperture,
  );
  const hasMedia = Boolean(data.durationMs || data.bitrate || data.codec);
  const hasTags = Boolean(data.title || data.artist || data.album);
  const contentSummary =
    data.kind === "folder"
      ? [
          `${data.fileCount ?? 0} ${
            data.fileCount === 1 ? "file" : "files"
          }`,
          `${data.folderCount ?? 0} ${
            data.folderCount === 1 ? "folder" : "folders"
          }`,
        ].join(", ")
      : undefined;

  return (
    <div className={cn("flex flex-col gap-4.5 overflow-auto p-4.25 text-xs", scrollGutter)}>
      <Section label="File">
        <Row label="Name" value={name} />
        <Row label="Path" value={data.path} />
        <Row label="Size" value={formatSize(data.size)} />
        <Row
          label="Type"
          value={
            data.kind === "folder"
              ? "Folder"
              : data.extension
                ? data.extension.toUpperCase()
                : data.category
          }
        />
        <Row label="Content" value={contentSummary} />
        <Row label="Modified" value={formatDate(data.modifiedAt)} />
        <Row label="Created" value={formatDate(data.createdAt)} />
        {data.width && data.height ? (
          <Row label="Dimensions" value={`${data.width} × ${data.height} px`} />
        ) : null}
      </Section>

      <Section label="Access">
        <dt>Visibility</dt>
        <dd>
          <VisibilityBadge
            visibility={data.visibility}
            source={data.visibilitySource}
          />
        </dd>
        {data.visibilitySource === "inherited" ? (
          <Row
            label="Inherited from"
            value={data.visibilityInheritedFrom || "My Drive"}
          />
        ) : null}
      </Section>

      {hasPhoto ? (
        <Section label="Photo">
          {data.takenAt ? <Row label="Captured" value={formatDate(data.takenAt)} /> : null}
          <Row label="Camera" value={data.camera} />
          <Row label="Lens" value={data.lens} />
          <Row label="ISO" value={data.iso?.toString()} />
          <Row label="Aperture" value={data.aperture ? `f/${data.aperture}` : undefined} />
          <Row label="Shutter" value={data.shutter} />
          <Row
            label="Focal length"
            value={data.focalLength ? `${data.focalLength} mm` : undefined}
          />
          <Row label="Software" value={data.software} />
        </Section>
      ) : null}

      {hasMedia ? (
        <Section label="Media">
          <Row
            label="Duration"
            value={data.durationMs ? formatDuration(data.durationMs) : undefined}
          />
          <Row label="Bitrate" value={data.bitrate ? formatBitrate(data.bitrate) : undefined} />
          <Row label="Codec" value={data.codec} />
          <Row label="Container" value={data.container} />
          <Row
            label="Amostragem"
            value={data.sampleRate ? `${(data.sampleRate / 1000).toFixed(1)} kHz` : undefined}
          />
          <Row label="Canais" value={data.channels?.toString()} />
        </Section>
      ) : null}

      {hasTags ? (
        <Section label="Faixa">
          <Row label="Title" value={data.title} />
          <Row label="Artista" value={data.artist} />
          <Row label="Album" value={data.album} />
          <Row label="Ano" value={data.year?.toString()} />
          <Row label="Faixa" value={data.track?.toString()} />
          <Row label="Genre" value={data.genre} />
        </Section>
      ) : null}

      {data.gps ? (
        <Section label="Location">
          <Row
            label="Coordinates"
            value={`${data.gps.latitude.toFixed(6)}, ${data.gps.longitude.toFixed(6)}`}
          />
          <dt className="text-muted">Mapa</dt>
          <dd>

            <a
              href={`https://www.openstreetmap.org/?mlat=${data.gps.latitude}&mlon=${data.gps.longitude}#map=16/${data.gps.latitude}/${data.gps.longitude}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Open in OpenStreetMap
              <ExternalLink className="w-3 h-3" />
            </a>
          </dd>
        </Section>
      ) : null}

      {data.error ? (
        <p className="text-muted">
          Metadata unavailable: {data.error}
        </p>
      ) : null}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md bg-surface p-4 [&>dl]:m-0 [&>dl]:grid [&>dl]:grid-cols-[minmax(76px,auto)_minmax(0,1fr)] [&>dl]:gap-x-3 [&>dl]:gap-y-2 [&_dt]:whitespace-nowrap [&_dt]:text-muted [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:font-medium [&_dd]:text-text [&_dd]:[overflow-wrap:anywhere] [&>h3]:mt-0 [&>h3]:mb-2.5 [&>h3]:text-11 [&>h3]:font-medium [&>h3]:tracking-[0.09em] [&>h3]:text-muted [&>h3]:uppercase">
      <h3>{label}</h3>
      <dl>{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
