import { useState } from "react";
import {
  Clock3,
  Copy,
  Download,
  Globe2,
  Link2,
  Loader2,
  LockKeyhole,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/shared/ui/cn";
import type { AccessState } from "../api/accessApi";
import type { SharedLink } from "../model/types";
import { absoluteUrl, copyText } from "../lib/shareLinks";
import {
  copyButton,
  copyField,
  createButton,
  emptyLinks,
  generalAccessIcon,
  generalAccessIconPrivate,
  generalAccessIconPublic,
  generalAccessRow,
  inheritNote,
  linkActions,
  linkBuilder,
  linkDetails,
  linkIcon,
  linkKindChip,
  linkKindChipActive,
  linkKindGroup,
  linkList,
  linkRow,
  linkRowInactive,
  linkStatusIcon,
  privateNote,
  revokeButton,
  rowButton,
  savingHint,
  section,
  sectionText,
  sectionTitle,
  visibilitySelect,
} from "../styles";

interface GeneralAccessSectionProps {
  access: AccessState;
  saving: boolean;
  publicUrl: string;
  onUpdate: (visibility: AccessState["visibility"]) => Promise<void>;
  onReset: () => Promise<void>;
  onToast: (message: string) => void;
}

export function GeneralAccessSection({
  access,
  saving,
  publicUrl,
  onUpdate,
  onReset,
  onToast,
}: GeneralAccessSectionProps) {
  const copyPublicUrl = () => {
    void copyText(publicUrl).then(() => onToast("Public link copied"));
  };

  return (
    <section className={section}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={cn(sectionTitle, "mb-0")}>General access</h3>
        {saving ? (
          <span className={savingHint}>
            <Loader2 className="animate-spin" />
            Salvando
          </span>
        ) : null}
      </div>

      <div className={generalAccessRow}>
        <div
          className={cn(
            generalAccessIcon,
            access.visibility === "public"
              ? generalAccessIconPublic
              : generalAccessIconPrivate,
          )}
          aria-hidden="true"
        >
          {access.visibility === "public" ? <Globe2 /> : <LockKeyhole />}
        </div>
        <div className="min-w-0 flex-1">
          <select
            className={visibilitySelect}
            value={access.visibility}
            disabled={saving}
            aria-label="Visibility through the public path"
            onChange={(event) =>
              void onUpdate(event.target.value as AccessState["visibility"])
            }
          >
            <option value="private">Restrito</option>
            <option value="public">Anyone with the path</option>
          </select>
          <p className={cn(sectionText, "px-3 text-11")}>
            {access.visibility === "public"
              ? "Anyone who knows the path can open it."
              : "The public path does not open this item."}
          </p>
        </div>
      </div>

      <div className={inheritNote}>
        <span>
          {access.source === "explicit"
            ? "Defined directly on this item."
            : access.source === "inherited"
              ? `Inherited from “${access.inheritedFrom || "My Drive"}”.`
              : "Private by default."}
        </span>
        {access.source === "explicit" ? (
          <button type="button" onClick={() => void onReset()} disabled={saving}>
            <RotateCcw />
            Use the folder rule
          </button>
        ) : null}
      </div>

      {access.visibility === "public" ? (
        <div className="mt-3">
          <div className={copyField}>
            <span title={publicUrl}>{publicUrl}</span>
            <button type="button" className={copyButton} onClick={copyPublicUrl}>
              <Copy />
              Copy
            </button>
          </div>
        </div>
      ) : (
        <div className={privateNote}>
          <LockKeyhole aria-hidden="true" />
          <span>
            Direct access is disabled. Create an access link below to
            share without making the item public.
          </span>
        </div>
      )}
    </section>
  );
}

type ExpiryChoice = "never" | "day" | "week" | "month" | "custom";

interface CreateAccessLinkSectionProps {
  creating: boolean;
  onCreate: (
    type: SharedLink["type"],
    expiresAt: string | null,
  ) => Promise<SharedLink | null>;
  onError: (message: string) => void;
  onToast: (message: string) => void;
}

export function CreateAccessLinkSection({
  creating,
  onCreate,
  onError,
  onToast,
}: CreateAccessLinkSectionProps) {
  const [linkType, setLinkType] = useState<SharedLink["type"]>("share");
  const [expiry, setExpiry] = useState<ExpiryChoice>("week");
  const [customExpiry, setCustomExpiry] = useState("");

  const resolveExpiry = () => {
    const now = Date.now();
    if (expiry === "never") return null;
    if (expiry === "day") return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    if (expiry === "week") return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (expiry === "month") return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    return customExpiry ? new Date(customExpiry).toISOString() : null;
  };

  const handleCreate = async () => {
    if (expiry === "custom" && !customExpiry) {
      onError("Choose an expiration date and time");
      return;
    }
    const created = await onCreate(linkType, resolveExpiry());
    if (!created) return;
    await copyText(absoluteUrl(created.url));
    onToast("Link created and copied");
  };

  return (
    <section className={section}>
      <h3 className={sectionTitle}>Create access link</h3>
      <p className={cn(sectionText, "mt-0 mb-3 text-11")}>
        The address is obfuscated, may expire, and remains revocable even without
        an expiration date.
      </p>
      <div className={linkKindGroup} role="radiogroup" aria-label="Link type">
        <button
          type="button"
          className={cn(linkKindChip, linkType === "share" && linkKindChipActive)}
          aria-pressed={linkType === "share"}
          onClick={() => setLinkType("share")}
        >
          <Link2 />
          Sharing
        </button>
        <button
          type="button"
          className={cn(
            linkKindChip,
            linkType === "download" && linkKindChipActive,
          )}
          aria-pressed={linkType === "download"}
          onClick={() => setLinkType("download")}
        >
          <Download />
          Download page
        </button>
      </div>
      <div className={linkBuilder}>
        <label>
          Expiration
          <select
            value={expiry}
            onChange={(event) => setExpiry(event.target.value as ExpiryChoice)}
          >
            <option value="never">Never expires</option>
            <option value="day">1 day</option>
            <option value="week">7 dias</option>
            <option value="month">30 dias</option>
            <option value="custom">Data personalizada</option>
          </select>
        </label>
        {expiry === "custom" ? (
          <label>
            Expires on
            <input
              type="datetime-local"
              value={customExpiry}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              onChange={(event) => setCustomExpiry(event.target.value)}
            />
          </label>
        ) : null}
        <button
          type="button"
          className={createButton}
          disabled={creating}
          onClick={() => void handleCreate()}
        >
          {creating ? <Loader2 className="animate-spin" /> : <Link2 />}
          Gerar e copy
        </button>
      </div>
    </section>
  );
}

interface AccessLinksListProps {
  links: SharedLink[];
  onRevoke: (link: SharedLink) => Promise<void>;
  onToast: (message: string) => void;
}

export function AccessLinksList({
  links,
  onRevoke,
  onToast,
}: AccessLinksListProps) {
  return (
    <section className={section}>
      <h3 className={sectionTitle}>
        Created links
        {links.length ? (
          <span className="ml-1.5 font-normal text-muted">({links.length})</span>
        ) : null}
      </h3>
      {links.length ? (
        <div className={linkList}>
          {links.map((link) => (
            <div
              className={cn(
                linkRow,
                (link.status === "expired" || link.status === "revoked") &&
                  linkRowInactive,
              )}
              key={link.id}
            >
              <div className={linkIcon}>
                {link.type === "download" ? <Download /> : <Link2 />}
              </div>
              <div className={linkDetails}>
                <strong>
                  {link.type === "download"
                    ? "Download page"
                    : "Sharing"}
                </strong>
                <span>
                  {link.status === "revoked"
                    ? "Revoked"
                    : link.status === "expired"
                      ? "Expired"
                      : link.expiresAt
                        ? `Expires on ${new Date(link.expiresAt).toLocaleString("en-US")}`
                        : "Never expires"}
                </span>
              </div>
              {link.status === "active" ? (
                <div className={linkActions}>
                  <button
                    type="button"
                    className={rowButton}
                    aria-label="Copy link"
                    title="Copy link"
                    onClick={() => {
                      void copyText(absoluteUrl(link.url)).then(() =>
                        onToast("Link copied"),
                      );
                    }}
                  >
                    <Copy />
                  </button>
                  <button
                    type="button"
                    className={cn(rowButton, revokeButton)}
                    aria-label="Revoke link"
                    title="Revoke link"
                    onClick={() => void onRevoke(link)}
                  >
                    <Trash2 />
                  </button>
                </div>
              ) : (
                <Clock3 className={linkStatusIcon} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={emptyLinks}>
          <Link2 aria-hidden="true" />
          <span>Created links will appear here.</span>
        </div>
      )}
    </section>
  );
}
