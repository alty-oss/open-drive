import type {
  FileFilter,
  SortDir,
  SortKey,
  ViewMode,
} from "../../model/types";


export interface ExplorerLocation {
  activeFilter: FileFilter;
  currentPath: string;
  onNavigate: (path: string) => void;
  onNavigateInNewTab: (path: string) => void;
  onMove: (itemPath: string, destFolder: string) => void;
}


export interface ExplorerViewState {
  viewMode: ViewMode;
  sortKey: SortKey;
  sortDir: SortDir;
  onViewModeChange: (mode: ViewMode) => void;
  onSortChange: (key: SortKey, dir: SortDir) => void;
}


export interface ExplorerCreateActions {
  canPaste: boolean;
  onUpload: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onPaste: () => void;
  onDownloadAll: () => void;
  onEmptyTrash: () => void;
}


export interface ExplorerSelectionActions {
  selectedCount: number;
  singleSelection: boolean;
  onCopySelected: () => void;
  onCutSelected: () => void;
  onDownloadSelected: () => void;
  onRenameSelected: () => void;
  onMoveSelected: () => void;
  onRestoreSelected: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
}

export interface ExplorerSearch {
  search: string;
  onSearchChange: (value: string) => void;
}
