export interface FileItem {
  path: string;
  name: string;
  isFolder: boolean;
  isImage: boolean;
  size: number;
  date: string;
  createdAt?: string;
  modifiedAt?: string;
  originalPath?: string;
  deletedAt?: string;
  isTrash?: boolean;
  visibility?: "public" | "private";
  visibilitySource?: "explicit" | "inherited" | "default";
  visibilityInheritedFrom?: string | null;
}

export interface FilePage {
  items: FileItem[];
  nextCursor: string | null;
  total: number;
}

export interface FileMetadata {
  path: string;
  name: string;
  size: number;
  category: string;
  extension: string;
  modifiedAt: string;
  createdAt: string;
  kind: "folder" | "image" | "audio" | "video" | "none" | "error";
  itemCount?: number;
  fileCount?: number;
  folderCount?: number;
  width?: number;
  height?: number;
  takenAt?: string;
  camera?: string;
  lens?: string;
  iso?: number;
  aperture?: number;
  shutter?: string;
  focalLength?: number;
  orientation?: number;
  software?: string;
  gps?: { latitude: number; longitude: number };
  durationMs?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  container?: string;
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  track?: number;
  genre?: string;
  error?: string;
  visibility: "public" | "private";
  visibilitySource: "explicit" | "inherited" | "default";
  visibilityInheritedFrom?: string | null;
}
