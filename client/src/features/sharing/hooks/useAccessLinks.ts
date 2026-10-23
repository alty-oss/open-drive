import { useEffect, useState } from "react";
import type { FileItem } from "@/shared/files/types";
import type { SharedLink } from "../model/types";
import {
  createItemLink,
  loadAccessLinks,
  resetItemVisibility,
  revokeItemLink,
  setItemVisibility,
  type AccessState,
} from "../api/accessApi";

interface UseAccessLinksOptions {
  item: FileItem;
  onChanged: () => void | Promise<void>;
  onToast: (message: string) => void;
}

export function useAccessLinks({
  item,
  onChanged,
  onToast,
}: UseAccessLinksOptions) {
  const [access, setAccess] = useState<AccessState>({
    visibility: item.visibility ?? "private",
    source: item.visibilitySource ?? "default",
    inheritedFrom: item.visibilityInheritedFrom ?? null,
  });
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAccess, setSavingAccess] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadAccessLinks(item.path)
      .then((result) => {
        if (!active) return;
        setAccess(result.access);
        setLinks(result.links);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load access settings",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [item.path]);

  const updateVisibility = async (visibility: AccessState["visibility"]) => {
    setSavingAccess(true);
    setError(null);
    try {
      setAccess(await setItemVisibility(item.path, visibility));
      await onChanged();
      onToast(
        visibility === "public" ? "Item is now public" : "Item is now private",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change access");
    } finally {
      setSavingAccess(false);
    }
  };

  const resetVisibility = async () => {
    setSavingAccess(true);
    setError(null);
    try {
      setAccess(await resetItemVisibility(item.path));
      await onChanged();
      onToast("The item now uses the folder setting");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to restore inherited access",
      );
    } finally {
      setSavingAccess(false);
    }
  };

  const createLink = async (
    type: SharedLink["type"],
    expiresAt: string | null,
  ) => {
    setCreatingLink(true);
    setError(null);
    try {
      const created = await createItemLink({ path: item.path, type, expiresAt });
      setLinks((current) => [created, ...current]);
      return created;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create link");
      return null;
    } finally {
      setCreatingLink(false);
    }
  };

  const revokeLink = async (link: SharedLink) => {
    try {
      await revokeItemLink(link.id);
      setLinks((current) =>
        current.map((candidate) =>
          candidate.id === link.id
            ? {
                ...candidate,
                status: "revoked",
                revokedAt: new Date().toISOString(),
              }
            : candidate,
        ),
      );
      onToast("Link revoked");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to revoke link");
    }
  };

  return {
    access,
    links,
    loading,
    savingAccess,
    creatingLink,
    error,
    setError,
    updateVisibility,
    resetVisibility,
    createLink,
    revokeLink,
  };
}
