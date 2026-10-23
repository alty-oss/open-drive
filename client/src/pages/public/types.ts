export interface PublicItem {
  path: string;
  name: string;
  isFolder: boolean;
  size: number;
  category: string;
  modifiedAt: string;
  createdAt: string;
}

export interface PublicPayload {
  mode: "public";
  item: PublicItem;
  children?: PublicItem[];
}

export interface DownloadPayload {
  mode: "download";
  expiresAt?: string | null;
  item: PublicItem;
}
