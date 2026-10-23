import {
  Clipboard,
  Copy,
  Download,
  FolderInput,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { FileFilter } from "../../model/types";
import ToolbarButton from "./ToolbarButton";
import type { ExplorerSelectionActions as SelectionActionsProps } from "./types";


const touchTarget =
  "max-md:size-11 max-md:rounded-full max-md:bg-surface-alt max-md:p-0 " +
  "max-md:[scroll-snap-align:start] max-md:[&>svg]:size-4.5";

const touchTargetDanger = `${touchTarget} max-md:bg-danger-soft`;
const touchTargetClear = `ml-1 ${touchTarget} max-md:ml-1.25 max-md:bg-surface-high`;

interface Props extends SelectionActionsProps {
  activeFilter: FileFilter;
}

export default function ExplorerSelectionActions({
  activeFilter,
  singleSelection,
  onCopySelected,
  onCutSelected,
  onDownloadSelected,
  onRenameSelected,
  onMoveSelected,
  onRestoreSelected,
  onDeleteSelected,
  onClearSelection,
}: Props) {
  const isTrash = activeFilter === "trash";

  return (
    <div className="flex min-w-0 flex-none items-center gap-1 max-md:pl-1.25">
      {!isTrash ? (
        <>
          <ToolbarButton
            label="Copy"
            onClick={onCopySelected}
            iconOnly
            className={touchTarget}
          >
            <Copy />
          </ToolbarButton>
          <ToolbarButton
            label="Cut"
            onClick={onCutSelected}
            iconOnly
            className={touchTarget}
          >
            <Clipboard />
          </ToolbarButton>
          <ToolbarButton
            label="Download"
            onClick={onDownloadSelected}
            iconOnly
            className={touchTarget}
          >
            <Download />
          </ToolbarButton>
        </>
      ) : null}
      {singleSelection && !isTrash ? (
        <>
          <ToolbarButton
            label="Rename"
            onClick={onRenameSelected}
            iconOnly
            className={touchTarget}
          >
            <Pencil />
          </ToolbarButton>
          <ToolbarButton
            label="Move to"
            onClick={onMoveSelected}
            iconOnly
            className={touchTarget}
          >
            <FolderInput />
          </ToolbarButton>
        </>
      ) : null}
      {singleSelection && isTrash ? (
        <ToolbarButton
          label="Restore"
          onClick={onRestoreSelected}
          iconOnly
          className={touchTarget}
        >
          <RotateCcw />
        </ToolbarButton>
      ) : null}
      <ToolbarButton
        label={isTrash ? " Delete definitivamente" : " Delete"}
        onClick={onDeleteSelected}
        danger
        iconOnly
        className={touchTargetDanger}
      >
        <Trash2 />
      </ToolbarButton>
      <ToolbarButton
        label="Clear selection"
        onClick={onClearSelection}
        iconOnly
        className={touchTargetClear}
      >
        <X />
      </ToolbarButton>
    </div>
  );
}
