import ConnectionStatus from "@/app/ConnectionStatus";
import { DashboardContextMenu } from "@/features/file-actions";
import { FileBrowser, Sidebar, WorkspaceTabs } from "@/features/explorer/ui";
import { SharedLinksView } from "@/features/sharing";
import { DropOverlay, UploadPanel } from "@/features/uploads";
import Toast from "@/shared/ui/Toast";
import type { ThemeMode } from "@/shared/ui/theme";
import DashboardLayout from "./components/DashboardLayout";
import DashboardModals from "./components/DashboardModals";
import { useDashboardController } from "./hooks/useDashboardController";

interface DashboardProps {
  onLogout: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export default function Dashboard({
  onLogout,
  theme,
  onToggleTheme,
}: DashboardProps) {
  const controller = useDashboardController({ onLogout });
  const {
    actions,
    closeAnd,
    closeContext,
    dropZone,
    emptyHint,
    emptyMessage,
    explorer,
    favorites,
    fileInputRef,
    filesState,
    fileView,
    folderActive,
    globalSearch,
    handleCopySelection,
    handleCutSelection,
    handleFilesUpload,
    handleFilterChange,
    handleKeyboardSelect,
    handleLogout,
    handlePasteClipboard,
    handleSearchChange,
    handleSortChange,
    handleViewModeChange,
    modal,
    openEditor,
    openPreview,
    rememberItem,
    requestModalClose,
    selectedItem,
    selection,
    socket,
    toast,
    ui,
    upload,
  } = controller;
  const { activeFilter, currentPath } = explorer;
  const uploadOrWarn = () => {
    if (folderActive) fileInputRef.current?.click();
    else toast.show("Open a folder in My Drive before uploading files");
  };
  const createFolderOrWarn = () => {
    if (folderActive) modal.openNewFolder();
    else toast.show("Open a folder in My Drive before creating a folder");
  };
  const createFileOrWarn = () => {
    if (folderActive) modal.openNewFile();
    else toast.show("Open a folder in My Drive before creating a file");
  };

  return (
    <DashboardLayout
      onDragEnter={folderActive ? dropZone.onDragEnter : undefined}
      onDragLeave={folderActive ? dropZone.onDragLeave : undefined}
      onDragOver={folderActive ? dropZone.onDragOver : undefined}
      onDrop={folderActive ? dropZone.onDrop : undefined}
      sidebar={
        <Sidebar
          totalSize={filesState.totalSize}
          trashCount={filesState.trashCount}
          stats={filesState.stats}
          activeFilter={activeFilter}
          currentPath={currentPath}
          favorites={favorites.favorites}
          onFavoriteOpen={explorer.handleNavigate}
          onFavoriteOpenInNewTab={explorer.handleOpenPathInNewTab}
          onFavoriteRemove={(path) => void favorites.toggleFavorite(path)}
          onFilterChange={handleFilterChange}
          onFilterOpenInNewTab={explorer.handleOpenFilterInNewTab}
          onLogout={handleLogout}
          open={ui.sidebarOpen}
          onClose={() => ui.setSidebarOpen(false)}
          collapsed={ui.sidebarCollapsed}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onToggleCollapsed={ui.toggleSidebarCollapsed}
        />
      }
      tabs={
        <WorkspaceTabs
          tabs={explorer.tabs}
          activeTabId={explorer.activeTabId}
          onActivate={explorer.handleActivateTab}
          onClose={explorer.handleCloseTab}
          onNewTab={explorer.handleNewTab}
        />
      }
      browser={


        activeFilter === "links" ? (
          <SharedLinksView
            onNavigate={explorer.handleNavigate}
            onToast={toast.show}
            onOpenSidebar={() => ui.setSidebarOpen(true)}
          />
        ) : (
        <FileBrowser
          currentPath={currentPath}
          activeFilter={activeFilter}
          viewMode={ui.viewMode}
          search={explorer.activeTab?.search ?? ""}
          sortKey={fileView.sortKey}
          sortDir={fileView.sortDir}
          files={fileView.visibleFiles}
          filteredCount={fileView.filtered.length}
          loading={
            globalSearch.active ? globalSearch.loading : filesState.filesLoading
          }
          error={globalSearch.active ? globalSearch.error : filesState.filesError}
          refreshing={!globalSearch.active && filesState.filesRefreshing}
          hasMore={globalSearch.active ? globalSearch.hasMore : filesState.hasMore}
          loadingMore={
            globalSearch.active
              ? globalSearch.loadingMore
              : filesState.loadingMore
          }
          paginationError={
            globalSearch.active
              ? globalSearch.paginationError
              : filesState.paginationError
          }
          totalCount={
            globalSearch.active
              ? globalSearch.totalCount
              : filesState.totalCount
          }
          selected={selection.selected}
          singleSelection={selection.selected.size === 1}
          canPaste={!!ui.clipboard && folderActive}
          ctxMenu={ui.ctxMenu}
          emptyMessage={emptyMessage}
          emptyHint={emptyHint}
          onOpenSidebar={() => ui.setSidebarOpen(true)}
          onViewModeChange={handleViewModeChange}
          onSearchChange={handleSearchChange}
          onSortChange={handleSortChange}
          onUpload={uploadOrWarn}
          onNewFolder={createFolderOrWarn}
          onNewFile={createFileOrWarn}
          onDownloadAll={actions.downloadAll}
          onEmptyTrash={actions.handleEmptyTrash}
          onCopySelected={handleCopySelection}
          onCutSelected={handleCutSelection}
          onPaste={handlePasteClipboard}
          onDownloadSelected={actions.downloadSelected}
          onRenameSelected={() =>
            selectedItem && modal.openRename(selectedItem)
          }
          onMoveSelected={() => selectedItem && modal.openMove(selectedItem)}
          onRestoreSelected={() =>
            selectedItem && actions.handleRestoreTrash(selectedItem)
          }
          onDeleteSelected={
            activeFilter === "trash"
              ? actions.handleBatchPermanentDelete
              : actions.handleBatchDelete
          }
          onClearSelection={selection.clearSelection}
          onRetry={
            globalSearch.active
              ? globalSearch.refresh
              : filesState.refreshFiles
          }
          onLoadMore={
            globalSearch.active ? globalSearch.loadMore : filesState.loadMore
          }
          onKeyboardSelect={handleKeyboardSelect}
          onNavigate={explorer.handleNavigate}
          onNavigateInNewTab={explorer.handleOpenPathInNewTab}
          onMove={actions.handleMove}
          onPrefetchFolder={filesState.prefetchPath}
          onSelect={selection.handleSelect}
          onToggleSelect={selection.toggleSelect}
          onOpen={explorer.handleOpen}
          onOpenInNewTab={explorer.handleOpenItemInNewTab}
          onCopy={(file) =>
            file.visibility === "public"
              ? actions.handleCopy(file)
              : modal.openAccess(file)
          }
          onItemInteraction={rememberItem}
          onAreaContextMenu={ui.setCtxMenu}
          onCloseContextMenu={closeContext}
          onContextMenu={(event, file) => {
            event.preventDefault();
            rememberItem(file);
            if (!selection.selected.has(file.path)) {
              selection.selectOnly(file.path);
            }
            ui.setCtxMenu({
              x: event.clientX,
              y: event.clientY,
              file,
              mode: "file",
            });
          }}
        />
        )
      }
      overlays={
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) {
                handleFilesUpload(event.target.files);
              }
              event.target.value = "";
            }}
          />
          <DropOverlay visible={folderActive && dropZone.dragging} />
          <ConnectionStatus socket={socket} />
          <Toast toasts={toast.toasts} onDismiss={toast.dismiss} />

          <DashboardContextMenu
            ctxMenu={ui.ctxMenu}
            selectedCount={selection.selected.size}
            onClose={closeContext}
            onPreview={(file) => closeAnd(() => openPreview(file))}
            onOpenFolderInNewTab={(folder) =>
              closeAnd(() => explorer.handleOpenFolderInNewTab(folder))
            }
            isFavorite={favorites.isFavorite}
            onToggleFavorite={(folder) =>
              closeAnd(() => void favorites.toggleFavorite(folder.path))
            }
            onEdit={(file) => closeAnd(() => openEditor(file))}
            onDetails={(file) => closeAnd(() => modal.openDetails(file))}
            onCopy={(file) => closeAnd(() => actions.handleCopy(file))}
            onAccess={(file) => closeAnd(() => modal.openAccess(file))}
            onToggleVisibility={(file) =>
              closeAnd(() => {
                void actions.handleToggleVisibility(file);
              })
            }
            onDownload={(file) =>
              closeAnd(() => actions.handleDownload(file))
            }
            onRename={(file) => closeAnd(() => modal.openRename(file))}
            onMove={(file) => closeAnd(() => modal.openMove(file))}
            onDelete={(file) => closeAnd(() => actions.handleDelete(file))}
            onRestore={(file) =>
              closeAnd(() => actions.handleRestoreTrash(file))
            }
            onPermanentDelete={(file) =>
              closeAnd(() => actions.handlePermanentDelete(file))
            }
            onBatchDelete={() =>
              closeAnd(
                activeFilter === "trash"
                  ? actions.handleBatchPermanentDelete
                  : actions.handleBatchDelete,
              )
            }
            onBatchDownload={() => closeAnd(actions.downloadSelected)}
            onUpload={() => closeAnd(uploadOrWarn)}
            onNewFolder={() => closeAnd(createFolderOrWarn)}
            onNewFile={() => closeAnd(createFileOrWarn)}
            onPaste={() => closeAnd(handlePasteClipboard)}
            canPaste={!!ui.clipboard && folderActive}
            onDownloadAll={() => closeAnd(actions.downloadAll)}
          />

          <DashboardModals
            modal={modal.modal}
            previewFiles={fileView.visibleFiles}
            onClose={modal.closeModal}
            onRequestEditorClose={requestModalClose}
            onEditorDirtyChange={modal.setEditorDirty}
            onRename={async (item, newName) => {
              if (await actions.handleRename(item, newName)) modal.closeModal();
            }}
            onCreateFolder={async (name) => {
              if (await actions.handleCreateFolder(name)) modal.closeModal();
            }}
            onCreateFile={async (name) => {
              const created = await actions.handleCreateFile(name);
              if (created) openEditor(created);
            }}
            onMove={actions.handleMove}
            onPreview={openPreview}
            onEdit={openEditor}
            onTogglePreviewDetails={modal.togglePreviewDetails}
            onToast={toast.show}
            currentPath={currentPath}
            onAccessChanged={filesState.refreshAll}
          />

          <UploadPanel
            items={upload.uploads}
            onPause={upload.pauseUpload}
            onResume={upload.resumeUpload}
            onCancel={upload.cancelUpload}
            onRetry={upload.retryUpload}
            onResolveConflict={upload.resolveConflict}
            onClearCompleted={upload.clearCompleted}
          />
        </>
      }
    />
  );
}
