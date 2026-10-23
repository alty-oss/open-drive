export function encodePath(filePath: string): string {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

export function fileUrl(item: { path: string; isTrash?: boolean }): string {
  return item.isTrash
    ? `/t/${encodeURIComponent(item.path)}`
    : `/api/content/${encodePath(item.path)}`;
}

export function publicFileUrl(item: { path: string }): string {
  return `/f/${encodePath(item.path)}`;
}
