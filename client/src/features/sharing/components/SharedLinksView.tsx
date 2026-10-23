import { useState } from "react";
import {
  AlertCircle,
  Eraser,
  Link2,
  Loader2,
  Menu,
  Search,
} from "lucide-react";
import ConfirmModal from "@/shared/ui/ConfirmModal";
import { cn } from "@/shared/ui/cn";
import { btn, spinner } from "@/shared/ui/styles";
import type { SharedLinkFilter } from "../model/types";
import { useSharedLinks } from "../hooks/useSharedLinks";
import SharedLinkRow from "./SharedLinkRow";
import {
  loadMoreButton,
  manageBody,
  manageCount,
  manageError,
  manageHeader,
  manageList,
  manageSearch,
  manageShell,
  manageState,
  manageTitle,
  manageTitleRow,
  manageToolbar,
  purgeButton,
  statusChip,
  statusChipActive,
  statusChipGroup,
} from "../styles";

const STATUS_TABS: { value: SharedLinkFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

interface SharedLinksViewProps {
  onNavigate: (path: string) => void;
  onToast: (message: string) => void;
  onOpenSidebar: () => void;
}








export default function SharedLinksView({
  onNavigate,
  onToast,
  onOpenSidebar,
}: SharedLinksViewProps) {
  const links = useSharedLinks({ onToast });
  const [confirmPurge, setConfirmPurge] = useState(false);

  const emptyLabel = links.search.trim()
    ? "No links match the search."
    : links.status === "all"
      ? "No links created yet. Use “Share” on a file to create the first one."
      : "No links with this status.";

  return (
    <div className={manageShell}>
      <header className={manageHeader}>
        <div className={manageTitleRow}>
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open navigation"
            className={cn(btn.icon, "md:hidden")}
          >
            <Menu className="size-4" />
          </button>
          <h1 className={manageTitle}>Shared links</h1>
          <span className={manageCount}>({links.counts.all})</span>
        </div>

        <div className={manageToolbar}>
          <div className={manageSearch}>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={links.search}
              placeholder="Search by path"
              aria-label="Search links by path"
              onChange={(event) => links.setSearch(event.target.value)}
            />
          </div>

          <div
            className={statusChipGroup}
            role="radiogroup"
            aria-label="Filter by status"
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={cn(
                  statusChip,
                  links.status === tab.value && statusChipActive,
                )}
                aria-pressed={links.status === tab.value}
                onClick={() => links.setStatus(tab.value)}
              >
                {tab.label}
                {tab.value !== "all" ? (
                  <span>({links.counts[tab.value]})</span>
                ) : null}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={purgeButton}
            disabled={!links.inactiveCount || links.purging}
            title={
              links.inactiveCount
                ? "Delete from history all revoked and expired links"
                : "No revoked or expired links"
            }
            onClick={() => setConfirmPurge(true)}
          >
            {links.purging ? <Loader2 className="animate-spin" /> : <Eraser />}
            Clear history
            {links.inactiveCount ? ` (${links.inactiveCount})` : ""}
          </button>
        </div>
      </header>

      <div className={manageBody}>
        {links.error ? (
          <div className={manageError} role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{links.error}</span>
          </div>
        ) : null}

        {links.loading ? (
          <div className={manageState} role="status" aria-live="polite">
            <span className={spinner} aria-hidden="true" />
            <span>Loading links…</span>
          </div>
        ) : links.links.length ? (
          <>
            <div className={manageList}>
              {links.links.map((link) => (
                <SharedLinkRow
                  key={link.id}
                  link={link}
                  busy={links.busyId === link.id}
                  onRevoke={(target) => void links.revoke(target)}
                  onPurge={(target) => void links.purge(target)}
                  onOpenTarget={onNavigate}
                  onToast={onToast}
                />
              ))}
            </div>
            {links.hasMore ? (
              <div className="flex">
                <button
                  type="button"
                  className={loadMoreButton}
                  disabled={links.loadingMore}
                  onClick={() => void links.loadMore()}
                >
                  {links.loadingMore ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Load more
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className={manageState}>
            <Link2 aria-hidden="true" />
            <span>{emptyLabel}</span>
          </div>
        )}
      </div>

      {confirmPurge ? (
        <ConfirmModal
          heading="Clear link history"
          description={`This permanently deletes ${links.inactiveCount} link(s) revogado(s) ou expired(s). Os links ativos continuam funcionando.`}
          confirmLabel="Clear"
          variant="danger"
          onCancel={() => setConfirmPurge(false)}
          onConfirm={() => {
            setConfirmPurge(false);
            void links.purgeAll();
          }}
        />
      ) : null}
    </div>
  );
}
