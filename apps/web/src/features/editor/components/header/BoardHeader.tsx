import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Copy, Download, Keyboard, Pencil, Share2, Star, Trash2 } from 'lucide-react';
import type { Board } from '@canvas/shared';
import { useAppDispatch } from '@/app/hooks';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { RenameDialog } from '@/components/common/RenameDialog';
import { cn } from '@/lib/cn';
import { toastShown } from '@/features/ui/uiSlice';
import { useBoardActions } from '@/features/boards/hooks/useBoardActions';
import { editorDialogOpened } from '../../slices/viewSlice';
import { exportBoard, type ExportFormat } from '../../canvas/export';
import { SaveStatus } from './SaveStatus';

export function BoardHeader({ board }: { board: Board }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const actions = useBoardActions();
  const [renaming, setRenaming] = useState(false);
  const [editingInline, setEditingInline] = useState(false);
  const [draft, setDraft] = useState(board.title);

  const doExport = (f: ExportFormat) => exportBoard(f, board.title).catch((e) => dispatch(toastShown((e as Error).message, 'error')));
  const commitInline = () => {
    setEditingInline(false);
    const t = draft.trim();
    if (t && t !== board.title) actions.rename(board.id, t);
    else setDraft(board.title);
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      {editingInline ? (
        <input
          autoFocus
          aria-label="Board title"
          className="h-9 w-56 rounded-lg border border-primary bg-surface px-2 text-lg font-semibold text-fg outline-none"
          value={draft}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitInline}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitInline();
            if (e.key === 'Escape') {
              setDraft(board.title);
              setEditingInline(false);
            }
          }}
          onFocus={(e) => e.target.select()}
        />
      ) : (
        <button
          type="button"
          className="truncate rounded-lg px-1.5 py-1 text-lg font-semibold text-fg hover:bg-surface-2"
          title="Rename"
          onClick={() => {
            setDraft(board.title);
            setEditingInline(true);
          }}
        >
          {board.title}
        </button>
      )}
      <button
        type="button"
        aria-label={board.isStarred ? 'Unstar board' : 'Star board'}
        aria-pressed={board.isStarred}
        onClick={() => actions.toggleStar(board.id, !board.isStarred)}
        className="rounded-lg p-1.5 hover:bg-surface-2"
      >
        <Star size={20} className={cn(board.isStarred ? 'fill-amber-400 text-amber-400' : 'text-muted')} />
      </button>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label="Board menu" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
            <ChevronDown size={18} />
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="w-56">
          <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
            Rename
          </MenuItem>
          <MenuItem icon={<Copy />} onSelect={() => actions.duplicate(board.id, true)}>
            Duplicate
          </MenuItem>
          <MenuItem icon={<Share2 />} onSelect={() => dispatch(editorDialogOpened('share'))}>
            Share view link
          </MenuItem>
          <MenuSeparator />
          <MenuLabel>Export</MenuLabel>
          <MenuItem icon={<Download />} onSelect={() => doExport('png')}>
            PNG image
          </MenuItem>
          <MenuItem icon={<Download />} onSelect={() => doExport('svg')}>
            SVG vector
          </MenuItem>
          <MenuItem icon={<Download />} onSelect={() => doExport('pdf')}>
            PDF document
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Keyboard />} onSelect={() => dispatch(editorDialogOpened('shortcuts'))}>
            Keyboard shortcuts
          </MenuItem>
          <MenuItem
            icon={<Trash2 />}
            danger
            onSelect={() => actions.trash(board.id).then((ok) => ok && navigate('/boards'))}
          >
            Move to Trash
          </MenuItem>
        </MenuContent>
      </Menu>
      <div className="mx-2 h-6 w-px bg-line max-md:hidden" />
      <div className="max-md:hidden">
        <SaveStatus />
      </div>
      <RenameDialog open={renaming} initial={board.title} onClose={() => setRenaming(false)} onSubmit={(t) => actions.rename(board.id, t)} />
    </div>
  );
}
