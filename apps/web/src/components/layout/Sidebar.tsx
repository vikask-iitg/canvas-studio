import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Clock, Copy, Crown, LayoutGrid, Menu as MenuIcon, MoreHorizontal, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import type { BoardSort, BoardSummary } from '@canvas/shared';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useMeQuery } from '@/services/authApi';
import { useListBoardsQuery } from '@/services/boardsApi';
import { Logo } from '@/components/ui/misc';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { RenameDialog } from '@/components/common/RenameDialog';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/time';
import { useDebounced } from '@/lib/useDebounced';
import { openDialog, setSidebarCollapsed, toggleSidebar } from '@/features/ui/uiSlice';
import { useBoardActions } from '@/features/boards/hooks/useBoardActions';

const NAV = [
  { to: '/boards', label: 'All Boards', icon: LayoutGrid, end: true },
  { to: '/boards/recent', label: 'Recent', icon: Clock },
  { to: '/boards/starred', label: 'Starred', icon: Star },
  { to: '/templates', label: 'Templates', icon: LayoutGrid },
  { to: '/trash', label: 'Trash', icon: Trash2 },
];

function BoardThumb({ board }: { board: BoardSummary }) {
  return board.thumbnailUrl ? (
    <img src={board.thumbnailUrl} alt="" className="h-9 w-12 shrink-0 rounded-md border border-line bg-white object-cover" loading="lazy" />
  ) : (
    <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md border border-line bg-gradient-to-br from-indigo-50 to-pink-50 text-[10px] font-semibold text-primary">
      {board.title.slice(0, 2).toUpperCase()}
    </span>
  );
}

function BoardRow({ board, active }: { board: BoardSummary; active: boolean }) {
  const actions = useBoardActions();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  return (
    <li className={cn('group relative flex items-center rounded-lg', active ? 'bg-primary-soft' : 'hover:bg-surface-2')}>
      <button type="button" onClick={() => navigate(`/board/${board.id}`)} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left">
        <BoardThumb board={board} />
        <span className="min-w-0">
          <span className={cn('block truncate text-sm', active ? 'font-semibold text-primary' : 'text-fg')}>{board.title}</span>
          <span className="block text-xs text-muted">{timeAgo(board.updatedAt)}</span>
        </span>
      </button>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label={`Actions for ${board.title}`} className="mr-1 rounded-md p-1.5 text-muted opacity-0 hover:bg-surface hover:text-fg focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100">
            <MoreHorizontal size={16} />
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
            Rename
          </MenuItem>
          <MenuItem icon={<Copy />} onSelect={() => actions.duplicate(board.id)}>
            Duplicate
          </MenuItem>
          <MenuItem icon={<Star />} onSelect={() => actions.toggleStar(board.id, !board.isStarred)}>
            {board.isStarred ? 'Unstar' : 'Star'}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} danger onSelect={() => actions.trash(board.id).then((ok) => ok && active && navigate('/boards'))}>
            Move to Trash
          </MenuItem>
        </MenuContent>
      </Menu>
      <RenameDialog open={renaming} initial={board.title} onClose={() => setRenaming(false)} onSubmit={(t) => actions.rename(board.id, t)} />
    </li>
  );
}

export function Sidebar() {
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const { id: activeId } = useParams();
  const actions = useBoardActions();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<BoardSort>('recent');
  const [listOpen, setListOpen] = useState(true);
  const debouncedQ = useDebounced(q, 250);
  const { data: boards, isFetching } = useListBoardsQuery({ view: 'all', q: debouncedQ, sort });
  const { data: me } = useMeQuery();
  const usage = me?.usage;

  // Collapse automatically on narrow screens (responsive spec: icons only below 1280px).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)');
    const apply = () => dispatch(setSidebarCollapsed(mq.matches));
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [dispatch]);

  if (collapsed) {
    return (
      <nav className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-4 max-md:hidden" aria-label="Main">
        <button type="button" aria-label="Expand sidebar" className="mb-2 rounded-lg p-2 hover:bg-surface-2" onClick={() => dispatch(toggleSidebar())}>
          <MenuIcon size={20} />
        </button>
        <Logo compact />
        <button type="button" aria-label="New board" title="New board" className="btn-primary mt-3 h-10 w-10 p-0" onClick={() => actions.create()}>
          <Plus size={18} />
        </button>
        <div className="mt-3 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              aria-label={label}
              className={({ isActive }) => cn('flex h-10 w-10 items-center justify-center rounded-lg', isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg')}
            >
              <Icon size={18} />
            </NavLink>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => dispatch(toggleSidebar())} aria-hidden />
      <nav
        className="flex w-[280px] shrink-0 flex-col border-r border-line bg-surface max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-pop"
        aria-label="Main"
      >
        <div className="flex items-center gap-2 px-4 pb-4 pt-5">
          <button type="button" aria-label="Collapse sidebar" className="rounded-lg p-1.5 hover:bg-surface-2" onClick={() => dispatch(toggleSidebar())}>
            <span className="md:hidden">
              <X size={20} />
            </span>
            <span className="max-md:hidden">
              <MenuIcon size={20} />
            </span>
          </button>
          <Logo />
        </div>

        <div className="px-4">
          <button type="button" className="btn-primary h-11 w-full rounded-xl" onClick={() => actions.create()} disabled={actions.creating}>
            <Plus size={18} /> New Board
          </button>
        </div>

        <ul className="mt-4 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-primary-soft font-semibold text-primary' : 'text-fg hover:bg-surface-2')
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-3 px-4">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input h-10 pl-9" placeholder="Search boards…" aria-label="Search boards" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="flex items-center gap-3 text-sm text-muted">
            Sort by
            <select className="input h-9 flex-1" value={sort} onChange={(e) => setSort(e.target.value as BoardSort)}>
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="created">Date created</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <button
            type="button"
            className="flex items-center gap-1 px-4 pb-1 text-sm font-medium text-fg"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
          >
            <ChevronDown size={14} className={cn('transition-transform', !listOpen && '-rotate-90')} />
            My Boards
            {isFetching && <span className="ml-auto h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />}
          </button>
          {listOpen && (
            <ul className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
              {boards?.items.map((b) => <BoardRow key={b.id} board={b} active={b.id === activeId} />)}
              {boards && !boards.items.length && (
                <li className="px-3 py-6 text-center text-sm text-muted">{debouncedQ ? `No boards match “${debouncedQ}”` : 'No boards yet — pick a template below.'}</li>
              )}
            </ul>
          )}
        </div>

        {usage && usage.limit !== null && (
          <div className="border-t border-line px-4 py-4">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={usage.boards} aria-label="Boards used">
              <div
                className={cn('h-full rounded-full', usage.boards >= usage.limit ? 'bg-danger' : 'bg-success')}
                style={{ width: `${Math.min(100, (usage.boards / usage.limit) * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-fg">
                {usage.boards} of {usage.limit} boards used
              </span>
              <button type="button" className="flex items-center gap-1 font-semibold text-amber-600 hover:underline" onClick={() => dispatch(openDialog('upgrade'))}>
                <Crown size={14} /> Upgrade
              </button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
