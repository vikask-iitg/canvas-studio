import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, LayoutGrid, Plus, Search, Star, Trash2 } from 'lucide-react';
import type { BoardSort, BoardView } from '@canvas/shared';
import { useListBoardsQuery } from '@/services/boardsApi';
import { TopBar } from '@/components/layout/TopBar';
import { EmptyState, Spinner } from '@/components/ui/misc';
import { useDebounced } from '@/lib/useDebounced';
import { BoardCard } from '../components/BoardCard';
import { useBoardActions } from '../hooks/useBoardActions';

const META: Record<BoardView, { title: string; icon: JSX.Element; empty: string; emptyBody: string }> = {
  all: { title: 'All Boards', icon: <LayoutGrid />, empty: 'No boards yet', emptyBody: 'Create a blank board or start from one of the templates below.' },
  recent: { title: 'Recent', icon: <Clock />, empty: 'Nothing opened recently', emptyBody: 'Boards you open show up here.' },
  starred: { title: 'Starred', icon: <Star />, empty: 'No starred boards', emptyBody: 'Star a board to keep it one click away.' },
  trash: { title: 'Trash', icon: <Trash2 />, empty: 'Trash is empty', emptyBody: 'Boards you delete stay here for 30 days before they’re removed for good.' },
};

export function BoardsPage({ trash }: { trash?: boolean }) {
  const params = useParams();
  const view: BoardView = trash ? 'trash' : params.view === 'recent' || params.view === 'starred' ? params.view : 'all';
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<BoardSort>('recent');
  const dq = useDebounced(q.trim(), 250);
  const { data, isLoading, isFetching } = useListBoardsQuery({ view, q: dq, sort });
  const actions = useBoardActions();
  const meta = META[view];

  return (
    <>
      <TopBar left={<h1 className="text-lg font-semibold">{meta.title}</h1>} />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <p className="mr-auto text-sm text-muted">
            {data ? `${data.total} board${data.total === 1 ? '' : 's'}` : ' '}
            {view === 'trash' && ' · deleted for good after 30 days'}
          </p>
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input w-60 pl-9" placeholder={`Search ${meta.title.toLowerCase()}…`} aria-label="Filter boards" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {view !== 'recent' && view !== 'trash' && (
            <select className="input w-40" aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as BoardSort)}>
              <option value="recent">Last edited</option>
              <option value="name">Name</option>
              <option value="created">Date created</option>
            </select>
          )}
          {isFetching && <Spinner className="h-4 w-4" />}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : data && data.items.length === 0 && !dq && view !== 'all' ? (
          <EmptyState icon={meta.icon} title={meta.empty}>
            {meta.emptyBody}
          </EmptyState>
        ) : data && data.items.length === 0 && dq ? (
          <EmptyState icon={<Search />} title={`No boards match “${dq}”`}>
            Try a different search term.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
            {view === 'all' && (
              <button
                type="button"
                onClick={() => actions.create()}
                disabled={actions.creating}
                className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm font-medium text-muted transition hover:border-primary hover:text-primary"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Plus size={22} />
                </span>
                New blank board
              </button>
            )}
            {data?.items.map((b) => <BoardCard key={b.id} board={b} />)}
          </div>
        )}
      </div>
    </>
  );
}
