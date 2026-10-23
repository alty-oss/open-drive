import {
  Copy,
  Download,
  Eraser,
  FolderOpen,
  Link2,
  Loader2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import FileIcon from "@/shared/files/FileIcon";
import { formatDate } from "@/shared/lib/format";
import { cn } from "@/shared/ui/cn";
import type { SharedLink } from "../model/types";
import { absoluteUrl, copyText } from "../lib/shareLinks";
import {
  linkIcon,
  manageActions,
  manageBadge,
  manageBadgeActive,
  manageBadgeInactive,
  manageBadgeMissing,
  manageBadges,
  manageIdentity,
  manageMeta,
  manageRow,
  manageRowInactive,
  revokeButton,
  rowButton,
} from "../styles";

const STATUS_LABELS: Record<SharedLink["status"], string> = {
  active: "Ativo",
  expired: "Expired",
  revoked: "Revoked",
};

function fileNameOf(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function parentOf(path: string) {
  return path.split("/").filter(Boolean).slice(0, -1).join("/");
}


function accessSummary(link: SharedLink) {
  if (!link.accessCount) return "No access yet";
  const times = link.accessCount === 1 ? "1 access" : `${link.accessCount} accesses`;
  if (!link.lastAccessedAt) return times;
  return `${times} · last on ${formatDate(link.lastAccessedAt)}`;
}

function expirySummary(link: SharedLink) {
  if (link.status === "revoked" && link.revokedAt) {
    return `Revoked on ${formatDate(link.revokedAt)}`;
  }
  if (link.status === "expired" && link.expiresAt) {
    return `Expirou em ${formatDate(link.expiresAt)}`;
  }
  if (link.expiresAt) return `Expires on ${formatDate(link.expiresAt)}`;
  return "Never expires";
}

interface SharedLinkRowProps {
  link: SharedLink;
  busy: boolean;
  onRevoke: (link: SharedLink) => void;
  onPurge: (link: SharedLink) => void;
  onOpenTarget: (path: string) => void;
  onToast: (message: string) => void;
}

export default function SharedLinkRow({
  link,
  busy,
  onRevoke,
  onPurge,
  onOpenTarget,
  onToast,
}: SharedLinkRowProps) {
  const name = fileNameOf(link.path);
  const isActive = link.status === "active";
  const missing = link.targetExists === false;

  return (
    <div className={cn(manageRow, !isActive && manageRowInactive)}>
      {missing ? (
        <div className={linkIcon} aria-hidden="true">
          {link.type === "download" ? <Download /> : <Link2 />}
        </div>
      ) : (
        <FileIcon name={name} isFolder={link.isFolder} size="sm" />
      )}

      <div className={manageIdentity}>
        <strong title={link.path}>{name}</strong>
        <span title={link.url}>{link.url}</span>
        <div className={manageBadges}>
          <span className={manageBadge}>
            {link.type === "download" ? <Download /> : <Link2 />}
            {link.type === "download" ? "Download page" : "Sharing"}
          </span>
          <span
            className={cn(
              manageBadge,
              isActive ? manageBadgeActive : manageBadgeInactive,
            )}
          >
            {STATUS_LABELS[link.status]}
          </span>
          {missing ? (
            <span className={cn(manageBadge, manageBadgeMissing)}>
              <TriangleAlert />
              File removido
            </span>
          ) : null}
        </div>
      </div>

      <div className={manageMeta}>
            <span>Created on {formatDate(link.createdAt)}</span>
        <span>{expirySummary(link)}</span>
        <span>{accessSummary(link)}</span>
      </div>

      <div className={manageActions}>
        {busy ? (
          <span className={rowButton} role="status" aria-label="Processing">
            <Loader2 className="animate-spin" />
          </span>
        ) : null}

        {isActive ? (
          <button
            type="button"
            className={rowButton}
            aria-label={`Copy link for ${name}`}
            title="Copy link"
            onClick={() => {
              void copyText(absoluteUrl(link.url)).then(() =>
                onToast("Link copied"),
              );
            }}
          >
            <Copy />
          </button>
        ) : null}

        {missing ? null : (
          <button
            type="button"
            className={rowButton}
            aria-label={`Open folder for ${name}`}
            title="Open in My Drive"
            onClick={() => onOpenTarget(parentOf(link.path))}
          >
            <FolderOpen />
          </button>
        )}

        {isActive ? (
          <button
            type="button"
            className={cn(rowButton, revokeButton)}
            disabled={busy}
            aria-label={`Revoke link for ${name}`}
            title="Revoke link"
            onClick={() => onRevoke(link)}
          >
            <Trash2 />
          </button>
        ) : (
          <button
            type="button"
            className={cn(rowButton, revokeButton)}
            disabled={busy}
            aria-label={`Delete from history the link for ${name}`}
            title="Delete from history"
            onClick={() => onPurge(link)}
          >
            <Eraser />
          </button>
        )}
      </div>
    </div>
  );
}
