import { formatBytes } from "../../../../shared/format/format.mjs";


export const formatSize = formatBytes;

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString("en-US");
}
