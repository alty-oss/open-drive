import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { logClientError } from "@/shared/lib/logger";
import { fetchPreviewBuffer } from "../../api/viewerApi";

interface DocxPreviewProps {
  url: string;
}

type PreviewStatus = "loading" | "ready" | "error";

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

function hardenRenderedLinks(container: HTMLElement) {
  container.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;

    try {
      const parsed = new URL(href, window.location.href);
      if (!SAFE_LINK_PROTOCOLS.has(parsed.protocol)) {
        link.removeAttribute("href");
        return;
      }
    } catch {
      link.removeAttribute("href");
      return;
    }

    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}






export default function DocxPreview({ url }: DocxPreviewProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const stylesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<PreviewStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    bodyRef.current?.replaceChildren();
    stylesRef.current?.replaceChildren();
    setStatus("loading");

    (async () => {
      try {

        const { renderAsync } = await import("docx-preview");
        const arrayBuffer = await fetchPreviewBuffer(url, controller.signal);
        if (!active) return;

        const stagedBody = document.createElement("div");
        const stagedStyles = document.createElement("div");

        await renderAsync(arrayBuffer, stagedBody, stagedStyles, {
          breakPages: true,
          experimental: true,
          ignoreLastRenderedPageBreak: false,
          renderAltChunks: false,
          renderEndnotes: true,
          renderFooters: true,
          renderFootnotes: true,
          renderHeaders: true,
          useBase64URL: true,
        });

        if (!active || !bodyRef.current || !stylesRef.current) return;

        hardenRenderedLinks(stagedBody);
        stylesRef.current.replaceChildren(...stagedStyles.childNodes);
        bodyRef.current.replaceChildren(...stagedBody.childNodes);
        setStatus("ready");
      } catch (caught) {
        if (!active || controller.signal.aborted) return;
        logClientError("preview.docx_failed", caught, { url });
        bodyRef.current?.replaceChildren();
        stylesRef.current?.replaceChildren();
        setStatus("error");
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [url]);

  return (
    <div className="docx-preview-container min-h-full">
      <div ref={stylesRef} />
      <div
        ref={bodyRef}
        className="docx-preview-body"
        role="document"
        aria-label="Document preview"
        aria-busy={status === "loading"}
      />

      {status === "loading" ? (
        <div
          className="flex items-center justify-center gap-2 p-8 text-xs text-muted"
          role="status"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Rendering document...
        </div>
      ) : null}

      {status === "error" ? (
        <div className="p-6 text-sm text-danger" role="alert">
          Unable to read this document.
        </div>
      ) : null}
    </div>
  );
}
