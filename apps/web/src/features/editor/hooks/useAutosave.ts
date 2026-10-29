import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector, useAppStore } from '@/app/hooks';
import type { store as appStore } from '@/app/store';
import { API_BASE, apiError } from '@/services/baseApi';
import { boardsApi } from '@/services/boardsApi';
import { clearBackup, writeBackup } from '@/lib/localBackup';
import type { VersionConflictBody } from '@canvas/shared';
import { conflictDetected, markedUnsaved, saveFailed, saveStarted, saveSucceeded } from '../slices/saveSlice';
import { renderThumbnail } from '../canvas/export';

const DEBOUNCE_MS = 1000;
const MAX_WAIT_MS = 5000;
const THUMBNAIL_EVERY_MS = 20_000;

type AppStore = typeof appStore;

/**
 * Debounced autosave (1 s after the last edit, at most every 5 s during continuous drawing),
 * optimistic-concurrency via `version`, retry with backoff while offline, and an IndexedDB
 * backup of unsaved work.
 */
export function useAutosave(boardId: string) {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const changeSeq = useAppSelector((s) => s.editor.document.changeSeq);
  const savedSeq = useAppSelector((s) => s.editor.save.savedSeq);
  const status = useAppSelector((s) => s.editor.save.status);

  const inFlight = useRef(false);
  const firstDirtyAt = useRef<number | null>(null);
  const retryDelay = useRef(2000);
  const lastThumbAt = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let backupTimer: ReturnType<typeof setTimeout> | undefined;

    const save = async () => {
      if (inFlight.current) return;
      const s = store.getState();
      const { elements, background, changeSeq: seq } = s.editor.document;
      if (seq === s.editor.save.savedSeq || s.editor.save.status === 'conflict' || s.editor.document.boardId !== boardId) return;
      inFlight.current = true;
      dispatch(saveStarted());
      try {
        const res = await dispatch(
          boardsApi.endpoints.saveBoardContent.initiate({ id: boardId, content: { elements }, background, version: s.editor.save.version }),
        ).unwrap();
        const stillDirty = store.getState().editor.document.changeSeq !== seq;
        dispatch(saveSucceeded({ version: res.version, seq, updatedAt: res.updatedAt, stillDirty }));
        firstDirtyAt.current = stillDirty ? Date.now() : null;
        retryDelay.current = 2000;
        if (!stillDirty) clearBackup(boardId);
        if (Date.now() - lastThumbAt.current > THUMBNAIL_EVERY_MS) {
          lastThumbAt.current = Date.now();
          renderThumbnail().then((dataUrl) => {
            if (dataUrl) dispatch(boardsApi.endpoints.uploadThumbnail.initiate({ id: boardId, dataUrl }));
          });
        }
      } catch (err) {
        const e = apiError(err);
        if (e.status === 409) {
          const body = e.body as VersionConflictBody;
          dispatch(conflictDetected(body.current));
        } else {
          dispatch(saveFailed({ offline: e.status === 'FETCH_ERROR' || !navigator.onLine }));
          retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
          timer = setTimeout(save, retryDelay.current);
        }
      } finally {
        inFlight.current = false;
      }
    };

    if (changeSeq !== savedSeq && status !== 'conflict') {
      dispatch(markedUnsaved());
      firstDirtyAt.current ??= Date.now();
      const waited = Date.now() - firstDirtyAt.current;
      timer = setTimeout(save, waited >= MAX_WAIT_MS ? 0 : Math.min(DEBOUNCE_MS, MAX_WAIT_MS - waited));
      backupTimer = setTimeout(() => {
        const s = store.getState();
        writeBackup({
          boardId,
          baseVersion: s.editor.save.version,
          elements: s.editor.document.elements,
          background: s.editor.document.background,
          savedAt: Date.now(),
        });
      }, 300);
    }

    const onOnline = () => save();
    window.addEventListener('online', onOnline);
    return () => {
      clearTimeout(timer);
      clearTimeout(backupTimer);
      window.removeEventListener('online', onOnline);
    };
  }, [changeSeq, savedSeq, status, boardId, dispatch, store]);

  useEffect(() => () => flushSave(store), [boardId, store]);

  // Last-chance save when the tab closes, plus the browser's "unsaved changes" prompt.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      const s = store.getState();
      if (s.editor.document.changeSeq === s.editor.save.savedSeq) return;
      const body = JSON.stringify({ content: { elements: s.editor.document.elements }, background: s.editor.document.background, version: s.editor.save.version });
      if (body.length < 60_000) {
        fetch(`${API_BASE}/boards/${boardId}`, {
          method: 'PATCH',
          keepalive: true,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.auth.accessToken ?? ''}` },
          body,
        }).catch(() => undefined);
      }
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [boardId, store]);
}

let lastFlush: { boardId: string; seq: number } | null = null;

/**
 * Fire-and-forget save of unsaved changes when leaving the editor. Idempotent per change
 * so the two unmount paths (workspace and page) can't send the same version twice.
 */
export function flushSave(store: AppStore) {
  const s = store.getState();
  const { boardId, changeSeq, elements, background } = s.editor.document;
  if (!boardId || changeSeq === s.editor.save.savedSeq || s.editor.save.status === 'conflict') return;
  if (lastFlush?.boardId === boardId && lastFlush.seq === changeSeq) return;
  lastFlush = { boardId, seq: changeSeq };
  writeBackup({ boardId, baseVersion: s.editor.save.version, elements, background, savedAt: Date.now() });
  store
    .dispatch(boardsApi.endpoints.saveBoardContent.initiate({ id: boardId, content: { elements }, background, version: s.editor.save.version }))
    .unwrap()
    .then(() => clearBackup(boardId))
    .catch(() => undefined);
}
