import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, MoreHorizontal, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react';
import { TRASH_RETENTION_DAYS, type BoardSummary } from '@canvas/shared';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { RenameDialog } from '@/components/common/RenameDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/time';
import { useBoardActions } from '../hooks/useBoardActions';

export function BoardCard({ board }: { board: BoardSummary }) {
  const navigate = useNavigate();
  const actions = useBoardActions();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const trashed = !!board.deletedAt;
  const daysLeft = trashed ? Math.max(0, TRASH_RETENTION_DAYS - Math.floor((Date.now() - Date.parse(board.deletedAt!)) / 86_400_000)) : 0;
  const open = () => !trashed && navigate(`/board/${board.id}`);

  return (
    <article className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <button type="button" onClick={open} className={cn('relative block aspect-[16/10] w-full overflow-hidden bg-surface-2', trashed && 'cursor-default opacity-70')} aria-label={`Open ${board.title}`}>
        {board.thumbnailUrl ? (
          <img src={board.thumbnailUrl} alt="" loading="lazy" className="h-full w-full bg-white object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-pink-50 font-hand text-3xl text-primary/70">{board.title}</span>
        )}
      </button>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-fg">{board.title}</h3>
          <p className="text-xs text-muted">
            {trashed ? `Deleted ${timeAgo(board.deletedAt!)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : `Edited ${timeAgo(board.updatedAt)}`}
          </p>
        </div>
        {!trashed && (
          <button
            type="button"
            aria-label={board.isStarred ? 'Unstar' : 'Star'}
            aria-pressed={board.isStarred}
            onClick={() => actions.toggleStar(board.id, !board.isStarred)}
            className="rounded-md p-1 hover:bg-surface-2"
          >
            <Star size={16} className={board.isStarred ? 'fill-amber-400 text-amber-400' : 'text-muted'} />
          </button>
        )}
        <Menu>
          <MenuTrigger asChild>
            <button type="button" aria-label={`Actions for ${board.title}`} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg">
              <MoreHorizontal size={16} />
            </button>
          </MenuTrigger>
          <MenuContent>
            {trashed ? (
              <>
                <MenuItem icon={<RotateCcw />} onSelect={() => actions.restore(board.id)}>
                  Restore
                </MenuItem>
                <MenuItem icon={<Trash2 />} danger onSelect={() => setConfirmDelete(true)}>
                  Delete permanently
                </MenuItem>
              </>
            ) : (
              <>
                <MenuItem icon={<ExternalLink />} onSelect={open}>
                  Open
                </MenuItem>
                <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
                  Rename
                </MenuItem>
                <MenuItem icon={<Copy />} onSelect={() => actions.duplicate(board.id)}>
                  Duplicate
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onSelect={() => actions.trash(board.id)}>
                  Move to Trash
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      </div>
      <RenameDialog open={renaming} initial={board.title} onClose={() => setRenaming(false)} onSubmit={(t) => actions.rename(board.id, t)} />
      <ConfirmDialog open={confirmDelete} title="Delete permanently?" danger confirmLabel="Delete" onClose={() => setConfirmDelete(false)} onConfirm={() => actions.deleteForever(board.id)}>
        “{board.title}” and its images will be deleted. This can’t be undone.
      </ConfirmDialog>
    </article>
  );
}
