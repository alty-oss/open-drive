export interface TypeStats {
  count: number;
  size: number;
}

export interface StorageStats {
  used: number;
  fileCount: number;
  folderCount: number;
  byType: Record<string, TypeStats>;
  trashCount: number;
  trashSize: number;
  totalUsed: number;
  quota: number;
  available: number;
  maxUploadSize: number;
}
