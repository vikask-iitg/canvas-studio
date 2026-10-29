import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Eye, LinkIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useSharedBoardQuery } from '@/services/boardsApi';
import { EmptyState, FullPageSpinner, Logo } from '@/components/ui/misc';
import { Toaster } from '@/components/ui/Toaster';
import { toastShown } from '@/features/ui/uiSlice';
import { boardLoaded, boardUnloaded } from '@/features/editor/slices/documentSlice';
import { readOnlySet } from '@/features/editor/slices/viewSlice';
import { CanvasStage } from '@/features/editor/components/canvas/CanvasStage';
import { exportBoard } from '@/features/editor/canvas/export';
import { timeAgo } from '@/lib/time';

/** Public, read-only view of a board opened from a share link. */
export function SharedBoardPage() {
  const { token = '' } = useParams();
  const dispatch = useAppDispatch();
  const { data, error, isLoading } = useSharedBoardQuery(token);
  const loaded = useAppSelector((s) => s.editor.document.boardId === data?.id);
  const signedIn = useAppSelector((s) => s.auth.status === 'authenticated');

  useEffect(() => {
    dispatch(readOnlySet(true));
    return () => {
      dispatch(boardUnloaded());
      dispatch(readOnlySet(false));
    };
  }, [dispatch]);

  useEffect(() => {
    if (data) dispatch(boardLoaded({ boardId: data.id, elements: data.content.elements, background: data.background, version: 0, updatedAt: data.updatedAt }));
  }, [data, dispatch]);

  if (isLoading) return <FullPageSpinner />;
  if (error || !data)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState icon={<LinkIcon />} title="This link doesn’t work" action={<Link to="/" className="btn-primary">Go to Canvas Studio</Link>}>
          The owner may have revoked it, or the board was deleted.
        </EmptyState>
      </div>
    );

  return (
    <div className="flex h-full flex-col bg-app">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-surface px-4">
        <Link to="/" aria-label="Canvas Studio home">
          <Logo compact />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{data.title}</h1>
          <p className="text-xs text-muted">
            by {data.ownerName} · updated {timeAgo(data.updatedAt)}
          </p>
        </div>
        <span className="ml-2 flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
          <Eye size={14} /> View only
        </span>
        <div className="flex-1" />
        <button className="btn-secondary" onClick={() => exportBoard('png', data.title).catch((e) => dispatch(toastShown((e as Error).message, 'error')))}>
          <Download size={16} /> PNG
        </button>
        <Link to="/boards" className="btn-primary max-sm:hidden">
          {signedIn ? 'My boards' : 'Open Canvas Studio'}
        </Link>
      </header>
      <div className="relative min-h-0 flex-1">{loaded && <CanvasStage />}</div>
      <Toaster />
    </div>
  );
}
