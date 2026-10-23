import { useState } from "react";
import ExplorerCommandBar from "./ExplorerCommandBar";
import ExplorerNavigationBar from "./ExplorerNavigationBar";
import MobileOptionsSheet from "./MobileOptionsSheet";
import { locationLabelFor } from "./explorerHeaderUi";
import type {
  ExplorerCreateActions,
  ExplorerLocation,
  ExplorerSearch,
  ExplorerSelectionActions,
  ExplorerViewState,
} from "./types";

export interface ExplorerHeaderProps
  extends ExplorerLocation,
    ExplorerViewState,
    ExplorerCreateActions,
    ExplorerSelectionActions,
    ExplorerSearch {
  onOpenSidebar: () => void;
}

export default function ExplorerHeader({
  activeFilter,
  currentPath,
  onNavigate,
  onNavigateInNewTab,
  onMove,
  search,
  onSearchChange,
  onOpenSidebar,
  viewMode,
  sortKey,
  sortDir,
  onViewModeChange,
  onSortChange,
  canPaste,
  onUpload,
  onNewFolder,
  onNewFile,
  onPaste,
  onDownloadAll,
  onEmptyTrash,
  ...selection
}: ExplorerHeaderProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
  const locationLabel = locationLabelFor(activeFilter, currentPath);

  const viewState: ExplorerViewState = {
    viewMode,
      sortKey,
    sortDir,
    onViewModeChange,
    onSortChange,
  };
  const createActions: ExplorerCreateActions = {
    canPaste,
    onUpload,
    onNewFolder,
    onNewFile,
    onPaste,
    onDownloadAll,
    onEmptyTrash,
  };

  return (
    <header className="shrink-0 border-b border-border-subtle bg-surface">
      <ExplorerNavigationBar
        activeFilter={activeFilter}
        currentPath={currentPath}
        onNavigate={onNavigate}
        onNavigateInNewTab={onNavigateInNewTab}
        onMove={onMove}
        search={search}
        onSearchChange={onSearchChange}
        locationLabel={locationLabel}
        onOpenSidebar={onOpenSidebar}
        mobileSearchOpen={mobileSearchOpen}
        onMobileSearchOpenChange={setMobileSearchOpen}
      />

      <ExplorerCommandBar
        activeFilter={activeFilter}
        mobileOptionsOpen={mobileOptionsOpen}
        onOpenMobileOptions={() => setMobileOptionsOpen(true)}
        {...viewState}
        {...createActions}
        {...selection}
      />

      {mobileOptionsOpen ? (
        <MobileOptionsSheet
          activeFilter={activeFilter}
          onClose={() => setMobileOptionsOpen(false)}
          {...viewState}
          {...createActions}
        />
      ) : null}
    </header>
  );
}
