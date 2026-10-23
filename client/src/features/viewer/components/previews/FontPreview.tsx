import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { logClientError } from "@/shared/lib/logger";
import { fetchPreviewBuffer } from "../../api/viewerApi";

interface FontPreviewProps {
  url: string;
  name: string;
}

interface FontInfo {
  family?: string;
  style?: string;
  version?: string;
  designer?: string;
  license?: string;
  glyphCount?: number;
  unitsPerEm?: number;
}

const SAMPLE_SIZES = [48, 32, 24, 18, 14];
const PANGRAM = "Pack my box with five dozen liquor jugs";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 !?&@#%()[]";

export default function FontPreview({ url, name }: FontPreviewProps) {
  const [info, setInfo] = useState<FontInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState(PANGRAM);


  const familyName = useMemo(
    () => `open-drive-font-${url.replace(/[^a-zA-Z0-9]/g, "-")}`,
    [url],
  );


  useEffect(() => {
    let active = true;
    let registered: FontFace | null = null;

    (async () => {
      try {
        const fontFace = new FontFace(familyName, `url("${url}")`);
        const loaded = await fontFace.load();
        if (!active) return;
        document.fonts.add(loaded);
        registered = loaded;
      } catch (caught) {
        logClientError("preview.font_face_failed", caught, { url });
      }
    })();

    return () => {
      active = false;
      if (registered) document.fonts.delete(registered);
    };
  }, [familyName, url]);


  useEffect(() => {
    let active = true;
    setInfo(null);
    setError(null);

    (async () => {
      try {
        const opentype = await import("opentype.js");
        const parsed = opentype.parse(await fetchPreviewBuffer(url));
        if (!active) return;
        const names = parsed.names ?? {};
        const pick = (entry?: Record<string, string>) =>
          entry ? (entry.en ?? Object.values(entry)[0]) : undefined;
        setInfo({
          family: pick(names.fontFamily),
          style: pick(names.fontSubfamily),
          version: pick(names.version),
          designer: pick(names.designer),
          license: pick(names.license),
          glyphCount: parsed.glyphs?.length,
          unitsPerEm: parsed.unitsPerEm,
        });
      } catch (caught) {
        if (!active) return;
        logClientError("preview.font_parse_failed", caught, { url });
        setError("Unable to read this font's data");
      }
    })();

    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className="p-4 flex flex-col gap-4 overflow-auto [scrollbar-gutter:stable]">
      <div>
        <label
          htmlFor="font-preview-sample"
          className="mb-1 block text-[10px] uppercase text-muted"
        >
          Sample text
        </label>
        <input
          id="font-preview-sample"
          type="text"
          value={sample}
          onChange={(event) => setSample(event.target.value)}
          className="w-full py-1.5 px-2 text-xs"
        />
      </div>

      <div className="flex flex-col gap-3">
        {SAMPLE_SIZES.map((size) => (
          <div key={size} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted">{size}px</span>
            <span
              className="break-words text-text"
              style={{ fontFamily: `"${familyName}", serif`, fontSize: size, lineHeight: 1.25 }}
            >
              {sample || PANGRAM}
            </span>
          </div>
        ))}
      </div>

      <pre
        className="break-words whitespace-pre-wrap text-xl text-text"
        style={{ fontFamily: `"${familyName}", serif`, lineHeight: 1.4 }}
      >
        {ALPHABET}
      </pre>

      <div className="border-t border-border-subtle pt-3">
        {error ? (
          <p className="text-xs text-muted">{error}</p>
        ) : info === null ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="w-3 h-3 animate-spin" />
            Reading font data...
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <FontRow label="File" value={name} />
            <FontRow label="Family" value={info.family} />
            <FontRow label="Style" value={info.style} />
            <FontRow label="Version" value={info.version} />
            <FontRow label="Designer" value={info.designer} />
            <FontRow label="Glyphs" value={info.glyphCount?.toLocaleString("en-US")} />
            <FontRow label="Units per em" value={info.unitsPerEm?.toString()} />
            <FontRow label="License" value={info.license} />
          </dl>
        )}
      </div>
    </div>
  );
}

function FontRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <>
      <dt className="italic text-muted">{label}</dt>
      <dd className="break-words text-text">{value}</dd>
    </>
  );
}
