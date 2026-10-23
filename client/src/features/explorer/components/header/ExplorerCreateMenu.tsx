import { FilePlus2, FolderPlus, Plus } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import { useMenuNavigation } from "@/shared/hooks/useMenuNavigation";
import AnchoredMenu, { menuItem } from "./AnchoredMenu";
import { usePopoverAnchor } from "./usePopoverAnchor";

interface ExplorerCreateMenuProps {
  onNewFolder: () => void;
  onNewFile: () => void;
}

export default function ExplorerCreateMenu({
  onNewFolder,
  onNewFile,
}: ExplorerCreateMenuProps) {
  const anchor = usePopoverAnchor({ width: 190, height: 92 });
  const navigation = useMenuNavigation(anchor.menuRef, anchor.open);

  return (
    <div className="relative flex-none">
      <button
        ref={anchor.anchorRef}
        type="button"
        className={cn(btn.primary, "h-9 px-3 text-sm")}
        aria-haspopup="menu"
        aria-expanded={anchor.open}
        onClick={anchor.toggle}
      >
        <Plus className="size-4" />
        New
      </button>
      {anchor.open ? (
        <AnchoredMenu
          menuRef={anchor.menuRef}
          label="Create new item"
          position={anchor.position}
          width={190}
          onKeyDown={navigation.onKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className={menuItem}
            onClick={() => anchor.run(onNewFolder)}
          >
            <FolderPlus />
            New folder
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItem}
            onClick={() => anchor.run(onNewFile)}
          >
            <FilePlus2 />
            New file
          </button>
        </AnchoredMenu>
      ) : null}
    </div>
  );
}
