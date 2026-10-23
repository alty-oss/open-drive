import type { FileChangeData } from "@/app/useSocket";

function parentOf(path: string) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}





export function foldersAffectedBy(data: FileChangeData): Set<string> | null {
  const folders = new Set<string>(data.paths ?? []);
  if (data.path !== undefined) {
    folders.add(data.path);

    if (data.event === "access-changed") folders.add(parentOf(data.path));
  }
  if (data.to !== undefined) folders.add(data.to);
  if (data.from !== undefined) folders.add(parentOf(data.from));
  return folders.size > 0 ? folders : null;
}
