import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import MarkdownPreview from "./MarkdownPreview";
import { logClientError } from "@/shared/lib/logger";
import { fetchPreviewJson } from "../../api/viewerApi";

interface NotebookPreviewProps {
  url: string;
}

interface NotebookOutput {
  output_type?: string;
  text?: string | string[];
  name?: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  data?: Record<string, unknown>;
}

interface NotebookCell {
  cell_type?: string;
  source?: string | string[];
  execution_count?: number | null;
  outputs?: NotebookOutput[];
}

interface Notebook {
  cells?: NotebookCell[];
  metadata?: { kernelspec?: { display_name?: string }; language_info?: { name?: string } };
}

function joinSource(source?: string | string[]): string {
  if (Array.isArray(source)) return source.join("");
  return source ?? "";
}


export default function NotebookPreview({ url }: NotebookPreviewProps) {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setNotebook(null);
    setError(null);

    (async () => {
      try {
        const parsed = await fetchPreviewJson<Notebook>(url);
        if (!active) return;
        if (!Array.isArray(parsed.cells)) throw new Error("No cells");
        setNotebook(parsed);
      } catch (caught) {
        if (!active) return;
        logClientError("preview.notebook_failed", caught, { url });
        setError("Unable to read this notebook");
      }
    })();

    return () => {
      active = false;
    };
  }, [url]);

  const language = useMemo(
    () =>
      notebook?.metadata?.language_info?.name ??
      notebook?.metadata?.kernelspec?.display_name ??
      "",
    [notebook],
  );

  if (error) {
    return <div className="p-4 text-xs text-muted">{error}</div>;
  }

  if (!notebook) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        Reading notebook...
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-3 overflow-auto [scrollbar-gutter:stable]">
      {language ? (
        <p className="text-[10px] uppercase text-muted">{language}</p>
      ) : null}

      {notebook.cells?.map((cell, index) => (
        <NotebookCellView key={index} cell={cell} />
      ))}
    </div>
  );
}

function NotebookCellView({ cell }: { cell: NotebookCell }) {
  const source = joinSource(cell.source);

  if (cell.cell_type === "markdown") {
    return (
      <div className="border-l-2 border-border pl-3">
        <MarkdownPreview content={source} />
      </div>
    );
  }

  if (cell.cell_type !== "code") return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <span className="shrink-0 pt-1 text-[10px] text-muted">
          [{cell.execution_count ?? " "}]
        </span>
        <pre
          className="flex-1 min-w-0 overflow-x-auto p-2 text-xs whitespace-pre"
          style={{ background: "var(--surface-alt)" }}
        >
          <code>{source}</code>
        </pre>
      </div>
      {cell.outputs?.map((output, index) => (
        <NotebookOutputView key={index} output={output} />
      ))}
    </div>
  );
}

function NotebookOutputView({ output }: { output: NotebookOutput }) {

  const png = output.data?.["image/png"];
  if (typeof png === "string") {
    return (
      <img
        src={`data:image/png;base64,${png.replace(/\s/g, "")}`}
        alt="Notebook output"
        className="max-w-full ml-6"
      />
    );
  }

  if (output.output_type === "error") {
    return (
    <pre className="ml-6 break-words whitespace-pre-wrap p-2 text-xs text-danger">
        {output.ename}: {output.evalue}
      </pre>
    );
  }

  const plain = output.data?.["text/plain"];
  const text = joinSource(
    (Array.isArray(plain) || typeof plain === "string"
      ? (plain as string | string[])
      : undefined) ?? output.text,
  );
  if (!text) return null;

  return (
    <pre className="ml-6 break-words whitespace-pre-wrap p-2 text-xs text-muted">
      {text}
    </pre>
  );
}
