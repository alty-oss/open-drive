import { useEffect, useRef } from "react";

export function useClipboardPaste(onFilesPaste: (files: FileList) => void) {
  const onFilesPasteRef = useRef(onFilesPaste);
  onFilesPasteRef.current = onFilesPaste;

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
      if (files.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        onFilesPasteRef.current(dt.files);
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, []);
}
