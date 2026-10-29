import { useMemo } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Group,
  ImageDown,
  Lock,
  MoreHorizontal,
  Trash2,
  Ungroup,
  Unlock,
  ZoomIn,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { toastShown } from '@/features/ui/uiSlice';
import {
  deleteSelection,
  duplicateSelection,
  groupSelection,
  reorderSelection,
  toggleLockSelection,
  ungroupSelection,
  zoomToFit,
} from '../../actions';
import { elementBounds, unionRects } from '../../canvas/geometry';
import { exportBoard } from '../../canvas/export';

const mod = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+';

/** Floating contextual toolbar above the current selection. */
export function SelectionToolbar({ width }: { width: number }) {
  const dispatch = useAppDispatch();
  const elements = useAppSelector((s) => s.editor.document.elements);
  const selectedIds = useAppSelector((s) => s.editor.view.selectedIds);
  const editingId = useAppSelector((s) => s.editor.view.editingId);
  const viewport = useAppSelector((s) => s.editor.view.viewport);
  const tool = useAppSelector((s) => s.editor.tools.tool);
  const title = useAppSelector((s) => s.editor.document.boardId);

  const selected = useMemo(() => {
    const ids = new Set(selectedIds);
    return elements.filter((e) => ids.has(e.id));
  }, [elements, selectedIds]);

  const bounds = useMemo(() => {
    const byId = new Map(elements.map((e) => [e.id, e]));
    return unionRects(selected.map((e) => elementBounds(e, byId)));
  }, [selected, elements]);

  if (!bounds || editingId || tool !== 'select') return null;

  const allLocked = selected.every((e) => e.locked);
  const grouped = selected.some((e) => e.groupId);
  const left = Math.min(Math.max(8, (bounds.x + bounds.width / 2) * viewport.scale + viewport.x - 70), width - 150);
  const topRaw = bounds.y * viewport.scale + viewport.y - 58;
  const top = topRaw < 8 ? (bounds.y + bounds.height) * viewport.scale + viewport.y + 16 : topRaw;

  return (
    <div
      className="absolute z-10 flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-pop"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Selection actions"
    >
      <IconButton label={`Duplicate (${mod}D)`} onClick={() => dispatch(duplicateSelection())} disabled={allLocked}>
        <Copy size={17} />
      </IconButton>
      <IconButton label="Delete (Del)" onClick={() => dispatch(deleteSelection())} disabled={allLocked}>
        <Trash2 size={17} />
      </IconButton>
      <Menu>
        <MenuTrigger asChild>
          <IconButton label="More actions">
            <MoreHorizontal size={17} />
          </IconButton>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuItem icon={<ChevronUp />} shortcut="]" onSelect={() => dispatch(reorderSelection('forward'))}>
            Bring forward
          </MenuItem>
          <MenuItem icon={<ChevronDown />} shortcut="[" onSelect={() => dispatch(reorderSelection('backward'))}>
            Send backward
          </MenuItem>
          <MenuItem icon={<ArrowUpToLine />} onSelect={() => dispatch(reorderSelection('front'))}>
            Bring to front
          </MenuItem>
          <MenuItem icon={<ArrowDownToLine />} onSelect={() => dispatch(reorderSelection('back'))}>
            Send to back
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={allLocked ? <Unlock /> : <Lock />} onSelect={() => dispatch(toggleLockSelection())}>
            {allLocked ? 'Unlock' : 'Lock'}
          </MenuItem>
          {selected.length > 1 && !grouped && (
            <MenuItem icon={<Group />} shortcut={`${mod}G`} onSelect={() => dispatch(groupSelection())}>
              Group
            </MenuItem>
          )}
          {grouped && (
            <MenuItem icon={<Ungroup />} shortcut={`${mod}⇧G`} onSelect={() => dispatch(ungroupSelection())}>
              Ungroup
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem icon={<ZoomIn />} onSelect={() => dispatch(zoomToFit(true))}>
            Zoom to selection
          </MenuItem>
          <MenuItem
            icon={<ImageDown />}
            onSelect={() =>
              exportBoard('png', `selection-${title ?? 'board'}`, selectedIds).catch((e) => dispatch(toastShown((e as Error).message, 'error')))
            }
          >
            Export selection as PNG
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
