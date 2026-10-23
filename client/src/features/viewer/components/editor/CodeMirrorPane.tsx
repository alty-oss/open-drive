import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";
import { getCodeMirrorLanguage } from "../../lib/editorLanguage";

interface CodeMirrorPaneProps {
  fileName: string;
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

const baseExtensions = [EditorView.lineWrapping];

const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: tags.heading1,
    color: "#f5aaaa",
    fontWeight: "700",
    fontSize: "1.28em",
  },
  {
    tag: tags.heading2,
    color: "#82d9a8",
    fontWeight: "700",
    fontSize: "1.16em",
  },
  {
    tag: tags.heading3,
    color: "#76a3b8",
    fontWeight: "700",
  },
  {
    tag: [tags.heading4, tags.heading5, tags.heading6],
    color: "#c7d3bf",
    fontWeight: "700",
  },
  {
    tag: tags.strong,
    color: "#f5aaaa",
    fontWeight: "700",
  },
  {
    tag: tags.emphasis,
    color: "#82d9a8",
    fontStyle: "italic",
  },
  {
    tag: tags.link,
    color: "#76a3b8",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  {
    tag: tags.quote,
    color: "#b9c7ae",
    fontStyle: "italic",
  },
  {
    tag: tags.list,
    color: "#f5aaaa",
  },
  {
    tag: tags.monospace,
    color: "#e6db74",
    backgroundColor: "#1e1f1c",
  },
  {
    tag: tags.contentSeparator,
    color: "#6f8578",
    fontWeight: "700",
  },
  {
    tag: tags.processingInstruction,
    color: "#6f8578",
    fontWeight: "700",
  },
  {
    tag: [tags.punctuation, tags.meta],
    color: "#6f8578",
  },
]);

const markdownEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "#1e1f1c",
  },
  ".cm-content": {
    caretColor: "#ffffff",
  },
  ".cm-line": {
    padding: "0 10px",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(111, 133, 120, 0.16)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(118, 163, 184, 0.32) !important",
  },
});

const languageLoaders: Record<string, () => Promise<Extension[]>> = {
  json: () => import("@codemirror/lang-json").then(({ json }) => [json()]),
  javascript: () =>
    import("@codemirror/lang-javascript").then(({ javascript }) => [
      javascript({ jsx: true }),
    ]),
  typescript: () =>
    import("@codemirror/lang-javascript").then(({ javascript }) => [
      javascript({ jsx: true, typescript: true }),
    ]),
  python: () =>
    import("@codemirror/lang-python").then(({ python }) => [python()]),
  markdown: () =>
    import("@codemirror/lang-markdown").then(({ markdown }) => [
      markdown(),
      syntaxHighlighting(markdownHighlightStyle),
      markdownEditorTheme,
    ]),
};

const languageCache = new Map<string, Promise<Extension[]>>();

export function loadCodeMirrorLanguage(language: string) {
  const loader = languageLoaders[language];
  if (!loader) return Promise.resolve<Extension[]>([]);
  const cached = languageCache.get(language);
  if (cached) return cached;
  const pending = loader();
  languageCache.set(language, pending);
  return pending;
}

export default function CodeMirrorPane({
  fileName,
  value,
  readOnly = false,
  onChange,
}: CodeMirrorPaneProps) {
  const language = getCodeMirrorLanguage(fileName);
  const [loadedLanguage, setLoadedLanguage] = useState<{
    name: string;
    extensions: Extension[];
  }>({ name: "", extensions: [] });
  const extensions = [
    ...baseExtensions,
    ...(loadedLanguage.name === language
      ? loadedLanguage.extensions
      : []),
  ];

  useEffect(() => {
    let active = true;
    void loadCodeMirrorLanguage(language).then((languageExtensions) => {
      if (active) {
        setLoadedLanguage({
          name: language,
          extensions: languageExtensions,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [language]);

  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={okaidia}
      extensions={extensions}
      basicSetup={{
        foldGutter: true,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
      }}
      readOnly={readOnly}
      editable={!readOnly}
      aria-label={`${readOnly ? "Preview" : "Editor"} for ${fileName}`}
      onChange={(nextValue) => onChange?.(nextValue)}
      className="h-full open-drive-codemirror"
    />
  );
}
