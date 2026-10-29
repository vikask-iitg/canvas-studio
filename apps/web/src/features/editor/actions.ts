import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { elementSchema, type CanvasElement } from '@canvas/shared';
import type { RootState } from '@/app/store';
import { newId } from '@/lib/ids';
import { toastShown } from '@/features/ui/uiSlice';
import { uploadImage } from '@/services/uploads';
import { elementsAdded, elementsRemoved, elementsReordered, elementsUpdated } from './slices/documentSlice';
import { selectionChanged, viewportChanged, editingStarted } from './slices/viewSlice';
import { toolSelected } from './slices/toolsSlice';
import { cloneElements, createImage, createText } from './canvas/factory';
import { contentBounds, fitRect, visibleWorldRect, zoomAround } from './canvas/geometry';
import { stageRegistry } from './canvas/stageRegistry';

type Thunk<R = void> = ThunkAction<R, RootState, unknown, UnknownAction>;

const CLIPBOARD_MARKER = 'canvas-studio/elements:';
let memoryClipboard: CanvasElement[] = [];

const selected = (s: RootState) => {
  const ids = new Set(s.editor.view.selectedIds);
  return s.editor.document.elements.filter((e) => ids.has(e.id));
};

/** Selected elements plus connectors joining two of them, so copies keep their arrows. */
const selectedWithConnectors = (s: RootState) => {
  const ids = new Set(s.editor.view.selectedIds);
  return s.editor.document.elements.filter(
    (e) => ids.has(e.id) || (e.type === 'connector' && ids.has(e.data.from ?? '') && ids.has(e.data.to ?? '')),
  );
};

function stageSize() {
  const s = stageRegistry.stage;
  return { width: s?.width() ?? window.innerWidth, height: s?.height() ?? window.innerHeight };
}

export const viewportCenter = (): Thunk<{ x: number; y: number }> => (_d, getState) => {
  const r = visibleWorldRect(getState().editor.view.viewport, stageSize().width, stageSize().height);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

function addAndSelect(els: CanvasElement[]): Thunk {
  return (dispatch) => {
    if (!els.length) return;
    dispatch(elementsAdded(els));
    dispatch(selectionChanged(els.filter((e) => e.type !== 'connector').map((e) => e.id)));
    dispatch(toolSelected('select'));
  };
}

export const duplicateSelection = (): Thunk => (dispatch, getState) => {
  dispatch(addAndSelect(cloneElements(selectedWithConnectors(getState()), 24, 24)));
};

export const deleteSelection = (): Thunk => (dispatch, getState) => {
  const ids = selected(getState()).filter((e) => !e.locked).map((e) => e.id);
  if (ids.length) dispatch(elementsRemoved(ids));
};

export const reorderSelection =
  (direction: 'forward' | 'backward' | 'front' | 'back'): Thunk =>
  (dispatch, getState) => {
    dispatch(elementsReordered({ ids: getState().editor.view.selectedIds, direction }));
  };

export const toggleLockSelection = (): Thunk => (dispatch, getState) => {
  const els = selected(getState());
  const lock = els.some((e) => !e.locked);
  dispatch(elementsUpdated(els.map((e) => ({ id: e.id, locked: lock }))));
};

export const groupSelection = (): Thunk => (dispatch, getState) => {
  const els = selected(getState()).filter((e) => e.type !== 'connector');
  if (els.length < 2) return;
  const groupId = newId('grp');
  dispatch(elementsUpdated(els.map((e) => ({ id: e.id, groupId }))));
};

export const ungroupSelection = (): Thunk => (dispatch, getState) => {
  const els = selected(getState()).filter((e) => e.groupId);
  if (els.length) dispatch(elementsUpdated(els.map((e) => ({ id: e.id, groupId: null }))));
};

export const selectAll = (): Thunk => (dispatch, getState) => {
  dispatch(toolSelected('select'));
  dispatch(selectionChanged(getState().editor.document.elements.filter((e) => e.type !== 'connector').map((e) => e.id)));
};

export const nudgeSelection =
  (dx: number, dy: number): Thunk =>
  (dispatch, getState) => {
    const els = selected(getState()).filter((e) => !e.locked && e.type !== 'connector');
    if (els.length) dispatch(elementsUpdated(els.map((e) => ({ id: e.id, x: e.x + dx, y: e.y + dy }))));
  };

// ---------- Clipboard ----------

export const copySelection =
  (cut = false): Thunk =>
  (dispatch, getState) => {
    const els = selectedWithConnectors(getState());
    if (!els.length) return;
    memoryClipboard = els;
    navigator.clipboard?.writeText(CLIPBOARD_MARKER + JSON.stringify(els)).catch(() => undefined);
    if (cut) dispatch(deleteSelection());
  };

/** Handles a paste event: Canvas Studio elements (any board), image files, or plain text. */
export const pasteFromClipboard =
  (data: DataTransfer | null): Thunk<boolean> =>
  (dispatch) => {
    const file = data && Array.from(data.files).find((f) => f.type.startsWith('image/'));
    if (file) {
      dispatch(insertImageFile(file));
      return true;
    }
    const text = data?.getData('text/plain') ?? '';
    if (text.startsWith(CLIPBOARD_MARKER)) {
      try {
        const parsed = elementSchema.array().parse(JSON.parse(text.slice(CLIPBOARD_MARKER.length)));
        dispatch(addAndSelect(cloneElements(parsed, 24, 24)));
        return true;
      } catch {
        /* fall through to plain text */
      }
    }
    if (text.trim()) {
      dispatch(insertText(text.trim().slice(0, 5000)));
      return true;
    }
    if (memoryClipboard.length) {
      dispatch(addAndSelect(cloneElements(memoryClipboard, 24, 24)));
      return true;
    }
    return false;
  };

const insertText =
  (text: string): Thunk =>
  (dispatch, getState) => {
    const c = dispatch(viewportCenter());
    const el = createText(c.x - 100, c.y - 20, getState().editor.tools, text);
    const lines = text.split('\n');
    el.width = Math.min(800, Math.max(...lines.map((l) => l.length)) * (el.style.fontSize ?? 24) * 0.5);
    el.height = lines.length * (el.style.fontSize ?? 24) * 1.2;
    dispatch(addAndSelect([el]));
  };

export const startTextAt =
  (x: number, y: number): Thunk =>
  (dispatch, getState) => {
    const el = createText(x, y, getState().editor.tools);
    dispatch(elementsAdded([el]));
    dispatch(selectionChanged([el.id]));
    dispatch(editingStarted(el.id));
  };

// ---------- Images ----------

export const insertImageFile =
  (file: File, at?: { x: number; y: number }): Thunk<Promise<void>> =>
  async (dispatch, getState) => {
    const boardId = getState().editor.document.boardId ?? undefined;
    dispatch(toastShown('Uploading image…'));
    try {
      const img = await uploadImage(file, boardId);
      const c = at ?? dispatch(viewportCenter());
      dispatch(addAndSelect([createImage(img.url, c.x, c.y, img.width, img.height)]));
    } catch (e) {
      dispatch(toastShown((e as Error).message || 'Upload failed', 'error'));
    }
  };

/** Opens the OS file picker and inserts the chosen images. */
export const pickAndInsertImage =
  (at?: { x: number; y: number }): Thunk =>
  (dispatch) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/gif', multiple: true });
    input.onchange = () => {
      Array.from(input.files ?? []).forEach((f, i) => dispatch(insertImageFile(f, at && { x: at.x + i * 32, y: at.y + i * 32 })));
    };
    input.click();
  };

// ---------- Viewport ----------

export const zoomBy =
  (factor: number): Thunk =>
  (dispatch, getState) => {
    const { width, height } = stageSize();
    const vp = getState().editor.view.viewport;
    dispatch(viewportChanged(zoomAround(vp, vp.scale * factor, { x: width / 2, y: height / 2 })));
  };

export const zoomTo =
  (scale: number): Thunk =>
  (dispatch, getState) => {
    const { width, height } = stageSize();
    dispatch(viewportChanged(zoomAround(getState().editor.view.viewport, scale, { x: width / 2, y: height / 2 })));
  };

export const zoomToFit =
  (onlySelection = false): Thunk =>
  (dispatch, getState) => {
    const s = getState();
    const els = onlySelection && s.editor.view.selectedIds.length ? selectedWithConnectors(s) : s.editor.document.elements;
    const b = contentBounds(els);
    const { width, height } = stageSize();
    dispatch(viewportChanged(b ? fitRect(b, width, height, 64, onlySelection ? 4 : 1) : { x: 0, y: 0, scale: 1 }));
  };
