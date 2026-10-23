export interface SharedLink {
  id: string;
  token: string;
  path: string;
  type: "share" | "download";
  url: string;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked";

  accessCount: number;
  lastAccessedAt: string | null;




  targetExists?: boolean;
  isFolder?: boolean;
}

export type SharedLinkStatus = SharedLink["status"];


export type SharedLinkFilter = "all" | SharedLinkStatus;

export interface SharedLinkCounts {
  all: number;
  active: number;
  expired: number;
  revoked: number;
}
