import { isSubtitleFile } from "@/shared/files/fileTypes";

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export function isSubtitleFileName(name: string): boolean {
  return isSubtitleFile(name.trim());
}

function parseTimestamp(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

function cleanCueText(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\{\\[^}]+\}/g, "")
    .trim();
}

export function parseSubtitleText(source: string): SubtitleCue[] {
  const normalized = source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!normalized) return [];

  const cues: SubtitleCue[] = [];
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split("\n").map((line) => line.trim());
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;

    const [startValue, endWithSettings] = lines[timingIndex].split(
      /\s+-->\s+/,
      2,
    );
    const endValue = endWithSettings?.split(/\s+/)[0];
    const start = parseTimestamp(startValue);
    const end = endValue ? parseTimestamp(endValue) : null;
    const text = cleanCueText(lines.slice(timingIndex + 1).join("\n"));

    if (start === null || end === null || end <= start || !text) continue;
    cues.push({ start, end, text });
  }

  return cues.sort((first, second) => first.start - second.start);
}
