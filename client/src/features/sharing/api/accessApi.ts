import type {
  SharedLink,
  SharedLinkCounts,
  SharedLinkFilter,
} from "../model/types";

export interface AccessState {
  visibility: "public" | "private";
  source: "explicit" | "inherited" | "default";
  inheritedFrom: string | null;
}

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function accessFrom(body: Record<string, unknown>): AccessState {
  return {
    visibility: body.visibility as AccessState["visibility"],
    source: body.source as AccessState["source"],
    inheritedFrom: (body.inheritedFrom as string | null) ?? null,
  };
}

export async function loadAccessLinks(path: string) {
  const query = new URLSearchParams({ path }).toString();
  const [accessResponse, linksResponse] = await Promise.all([
    fetch(`/api/access?${query}`),
    fetch(`/api/links?${query}`),
  ]);
  if (!accessResponse.ok || !linksResponse.ok) {
    throw new Error("Unable to load as access settings");
  }
  const accessBody = await accessResponse.json();
  const linksBody = await linksResponse.json();
  return {
    access: accessFrom(accessBody),
    links: (linksBody.links ?? []) as SharedLink[],
  };
}

export async function setItemVisibility(
  path: string,
  visibility: AccessState["visibility"],
): Promise<AccessState> {
  const response = await fetch("/api/access", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, visibility }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Unable to change access"));
  }
  return accessFrom(await response.json());
}

export async function resetItemVisibility(path: string): Promise<AccessState> {
  const query = new URLSearchParams({ path }).toString();
  const response = await fetch(`/api/access?${query}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(
      await readError(response, "Unable to restore inherited access"),
    );
  }
  return accessFrom(await response.json());
}

export async function createItemLink(input: {
  path: string;
  type: SharedLink["type"];
  expiresAt: string | null;
}): Promise<SharedLink> {
  const response = await fetch("/api/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Unable to create link"));
  }
  return response.json();
}

export async function revokeItemLink(id: string): Promise<void> {
  const response = await fetch(`/api/links/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Unable to revoke link"));
  }
}



export interface SharedLinksPage {
  items: SharedLink[];
  nextCursor: string | null;
  counts: SharedLinkCounts;
}

export async function listAllLinks(
  params: { status?: SharedLinkFilter; search?: string; cursor?: string },
  signal?: AbortSignal,
): Promise<SharedLinksPage> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.cursor) query.set("cursor", params.cursor);
  const response = await fetch(`/api/links/all?${query.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(await readError(response, "Unable to list links"));
  }
  return response.json();
}


export async function purgeItemLink(id: string): Promise<void> {
  const response = await fetch(`/api/links/${encodeURIComponent(id)}/purge`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Unable to delete the link"));
  }
}

export async function purgeInactiveLinks(): Promise<number> {
  const response = await fetch("/api/links/purge", { method: "POST" });
  if (!response.ok) {
    throw new Error(
      await readError(response, "Unable to clear link history"),
    );
  }
  const body = await response.json();
  return typeof body?.removed === "number" ? body.removed : 0;
}
