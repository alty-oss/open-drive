







export interface UploadEntry {
  file: File;

  relativePath: string;
}

export interface DroppedTree {
  entries: UploadEntry[];

  emptyDirectories: string[];

  truncated: boolean;
}


const MAX_ENTRIES = 5000;

const MAX_DEPTH = 32;

function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}






async function readAllEntries(
  directory: FileSystemDirectoryEntry,
): Promise<FileSystemEntry[]> {
  const reader = directory.createReader();
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await readBatch(reader);
    if (batch.length === 0) break;
    all.push(...batch);
    if (all.length > MAX_ENTRIES) break;
  }
  return all;
}

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walk(
  entry: FileSystemEntry,
  prefix: string,
  depth: number,
  result: DroppedTree,
): Promise<void> {
  if (result.entries.length >= MAX_ENTRIES) {
    result.truncated = true;
    return;
  }
  if (depth > MAX_DEPTH) return;

  if (entry.isFile) {
    try {
      const file = await readFile(entry as FileSystemFileEntry);
      result.entries.push({ file, relativePath: `${prefix}${entry.name}` });
    } catch {}
    return;
  }

  if (!entry.isDirectory) return;

  const directoryPath = `${prefix}${entry.name}`;
  const children = await readAllEntries(entry as FileSystemDirectoryEntry).catch(
    () => [] as FileSystemEntry[],
  );

  if (children.length === 0) {
    result.emptyDirectories.push(directoryPath);
    return;
  }

  for (const child of children) {
    await walk(child, `${directoryPath}/`, depth + 1, result);
  }
}


export function entriesFromFileList(files: FileList | File[]): UploadEntry[] {
  return Array.from(files).map((file) => ({
    file,

    relativePath: file.webkitRelativePath || file.name,
  }));
}

export async function readDroppedTree(
  dataTransfer: DataTransfer,
): Promise<DroppedTree> {
  const result: DroppedTree = {
    entries: [],
    emptyDirectories: [],
    truncated: false,
  };




  const roots: FileSystemEntry[] = [];
  const items = dataTransfer.items;
  if (items) {
    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry?.();
      if (entry) roots.push(entry);
    }
  }

  if (roots.length === 0) {

    result.entries = entriesFromFileList(dataTransfer.files);
    return result;
  }

  for (const root of roots) {
    await walk(root, "", 0, result);
  }
  return result;
}


export function parentOf(relativePath: string): string {
  const index = relativePath.lastIndexOf("/");
  return index === -1 ? "" : relativePath.slice(0, index);
}


export function topLevelName(relativePath: string): string {
  const index = relativePath.indexOf("/");
  return index === -1 ? relativePath : relativePath.slice(0, index);
}

export function joinPath(base: string, relative: string): string {
  if (!base) return relative;
  if (!relative) return base;
  return `${base}/${relative}`;
}

export const UPLOAD_ENTRY_LIMIT = MAX_ENTRIES;
