import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileQuestion, RotateCcw } from 'lucide-react';
import { useAppDispatch, useAppSelector, useAppStore } from '@/app/hooks';
import { useGetBoardQuery, useUploadThumbnailMutation } from '@/services/boardsApi';
import { renderThumbnail } from '../canvas/export';
import { apiError } from '@/services/baseApi';
import { clearBackup, readBackup } from '@/lib/localBackup';
import { EmptyState, FullPageSpinner } from '@/components/ui/misc';
import { TopBar } from '@/components/layout/TopBar';
import { toastShown } from '@/features/ui/uiSlice';
import { useBoardActions } from '@/features/boards/hooks/useBoardActions';
import { boardLoaded, boardUnloaded } from '../slices/documentSlice';
import { readOnlySet } from '../slices/viewSlice';
import { flushSave, useAutosave } from '../hooks/useAutosave';
import { useEditorShortcuts } from '../hooks/useEditorShortcuts';
import { BoardHeader } from '../components/header/BoardHeader';
import { Toolbar } from '../components/toolbar/Toolbar';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { BackgroundPanel } from '../components/background/BackgroundPanel';
import { ShortcutsDialog } from '../components/dialogs/ShortcutsDialog';
import { ShareDialog } from '../components/dialogs/ShareDialog';
import { ConflictDialog } from '../components/dialogs/ConflictDialog';

function EditorWorkspace({ boardId, title, hasThumbnail }: { boardId: string; title: string; hasThumbnail: boolean }) {
  const panelOpen = useAppSelector((s) => s.editor.view.backgroundPanelOpen);
  const [uploadThumbnail] = useUploadThumbnailMutation();
  useAutosave(boardId);
  useEditorShortcuts();

  // Boards created from a template (or never edited) get a dashboard thumbnail on first open.
  useEffect(() => {
    if (hasThumbnail) return;
    const t = setTimeout(() => {
      renderThumbnail().then((dataUrl) => {
        if (dataUrl) uploadThumbnail({ id: boardId, dataUrl });
      });
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 max-md:pb-24">
      <Toolbar boardTitle={title} />
      <div className="relative flex min-h-0 flex-1 gap-3">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <CanvasStage />
        </div>
        {panelOpen && <BackgroundPanel />}
      </div>
      <ShortcutsDialog />
      <ShareDialog boardId={boardId} />
      <ConflictDialog />
    </div>
  );
}

export function EditorPage() {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const actions = useBoardActions();
  const { data: board, error, isLoading } = useGetBoardQuery(id);
  const loadedId = useAppSelector((s) => s.editor.document.boardId);

  useEffect(() => {
    dispatch(readOnlySet(false));
    return () => {
      flushSave(store);
      dispatch(boardUnloaded());
    };
  }, [dispatch, store]);

  useEffect(() => {
    if (!board || loadedId === board.id) return;
    let cancelled = false;
    readBackup(board.id).then((backup) => {
      if (cancelled) return;
      const base = { boardId: board.id, version: board.version, updatedAt: board.updatedAt };
      if (backup && backup.baseVersion === board.version && backup.savedAt > Date.parse(board.updatedAt)) {
        dispatch(boardLoaded({ ...base, elements: backup.elements, background: backup.background, dirty: true }));
        dispatch(toastShown('Recovered unsaved changes from this device', 'success'));
      } else {
        if (backup) clearBackup(board.id);
        dispatch(boardLoaded({ ...base, elements: board.content.elements, background: board.background }));
      }
    });
    return () => {
      cancelled = true;
    };
    // Load once per board; later cache updates (title/star) must not reset the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, loadedId, dispatch]);

  if (error) {
    const e = apiError(error);
    return (
      <>
        <TopBar />
        <div className="p-6">
          <EmptyState
            icon={<FileQuestion />}
            title={e.status === 404 ? 'Board not found' : 'Could not open this board'}
            action={
              <Link to="/boards" className="btn-primary">
                Back to boards
              </Link>
            }
          >
            {e.status === 404 ? 'It may have been deleted, or you don’t have access to it.' : e.message}
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar left={board ? <BoardHeader board={board} /> : null} />
      {board?.deletedAt && (
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          This board is in the Trash.
          <button className="btn-secondary h-8" onClick={() => actions.restore(board.id)}>
            <RotateCcw size={14} /> Restore
          </button>
        </div>
      )}
      {isLoading || !board || loadedId !== board.id ? <FullPageSpinner /> : <EditorWorkspace boardId={board.id} title={board.title} hasThumbnail={!!board.thumbnailUrl} />}
    </>
  );
}
