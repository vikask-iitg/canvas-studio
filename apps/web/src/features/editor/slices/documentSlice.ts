import { createSlice, original, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_BACKGROUND, MAX_UNDO_STEPS, type Background, type CanvasElement } from '@canvas/shared';

interface Snapshot {
  elements: CanvasElement[];
  background: Background;
}

export interface DocumentState {
  boardId: string | null;
  elements: CanvasElement[];
  background: Background;
  past: Snapshot[];
  future: Snapshot[];
  /** Increments on every content change; autosave compares it to the last saved value. */
  changeSeq: number;
}

const initialState: DocumentState = {
  boardId: null,
  elements: [],
  background: DEFAULT_BACKGROUND,
  past: [],
  future: [],
  changeSeq: 0,
};

/** Records the pre-change state for undo. Must run before the reducer mutates anything. */
function checkpoint(state: DocumentState) {
  const elements = original(state.elements) ?? state.elements;
  const background = original(state.background) ?? state.background;
  state.past.push({ elements, background });
  if (state.past.length > MAX_UNDO_STEPS) state.past.shift();
  state.future = [];
  state.changeSeq++;
}

export type ElementPatch = { id: string } & Partial<Omit<CanvasElement, 'id'>>;

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    boardLoaded(
      state,
      { payload }: PayloadAction<{ boardId: string; elements: CanvasElement[]; background: Background; version: number; updatedAt: string; dirty?: boolean }>,
    ) {
      state.boardId = payload.boardId;
      state.elements = payload.elements;
      state.background = payload.background;
      state.past = [];
      state.future = [];
      state.changeSeq = payload.dirty ? 1 : 0;
    },
    boardUnloaded() {
      return initialState;
    },
    /** Replace content without touching undo history (conflict resolution). */
    contentReplaced(state, { payload }: PayloadAction<{ elements: CanvasElement[]; background: Background }>) {
      state.elements = payload.elements;
      state.background = payload.background;
      state.past = [];
      state.future = [];
    },
    elementsAdded(state, { payload }: PayloadAction<CanvasElement[]>) {
      if (!payload.length) return;
      checkpoint(state);
      const maxZ = state.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      payload.forEach((el, i) => state.elements.push({ ...el, zIndex: maxZ + i + 1 }));
    },
    elementsUpdated(state, { payload }: PayloadAction<ElementPatch[]>) {
      const patches = new Map(payload.map((p) => [p.id, p]));
      if (!state.elements.some((e) => patches.has(e.id))) return;
      checkpoint(state);
      state.elements.forEach((el, i) => {
        const p = patches.get(el.id);
        if (!p) return;
        state.elements[i] = {
          ...el,
          ...p,
          style: p.style ? { ...el.style, ...p.style } : el.style,
          data: p.data ? { ...el.data, ...p.data } : el.data,
        };
      });
    },
    elementsRemoved(state, { payload }: PayloadAction<string[]>) {
      const ids = new Set(payload);
      // Connectors attached to removed elements go with them.
      for (const el of state.elements) {
        if (el.type === 'connector' && (ids.has(el.data.from ?? '') || ids.has(el.data.to ?? ''))) ids.add(el.id);
      }
      if (!state.elements.some((e) => ids.has(e.id))) return;
      checkpoint(state);
      state.elements = state.elements.filter((e) => !ids.has(e.id));
    },
    elementsReordered(state, { payload }: PayloadAction<{ ids: string[]; direction: 'forward' | 'backward' | 'front' | 'back' }>) {
      const ids = new Set(payload.ids);
      if (!ids.size) return;
      checkpoint(state);
      const sorted = [...state.elements].sort((a, b) => a.zIndex - b.zIndex);
      let order: CanvasElement[];
      if (payload.direction === 'front') order = [...sorted.filter((e) => !ids.has(e.id)), ...sorted.filter((e) => ids.has(e.id))];
      else if (payload.direction === 'back') order = [...sorted.filter((e) => ids.has(e.id)), ...sorted.filter((e) => !ids.has(e.id))];
      else {
        order = sorted;
        const step = payload.direction === 'forward' ? 1 : -1;
        const indices = order.map((e, i) => (ids.has(e.id) ? i : -1)).filter((i) => i >= 0);
        if (step === 1) indices.reverse();
        for (const i of indices) {
          const j = i + step;
          if (j < 0 || j >= order.length || ids.has(order[j].id)) continue;
          [order[i], order[j]] = [order[j], order[i]];
        }
      }
      const z = new Map(order.map((e, i) => [e.id, i + 1]));
      state.elements = state.elements.map((e) => (z.get(e.id) === e.zIndex ? e : { ...e, zIndex: z.get(e.id)! }));
    },
    backgroundChanged(state, { payload }: PayloadAction<Background>) {
      checkpoint(state);
      state.background = payload;
    },
    boardCleared(state) {
      if (!state.elements.length) return;
      checkpoint(state);
      state.elements = [];
    },
    undo(state) {
      const prev = state.past.pop();
      if (!prev) return;
      state.future.push({ elements: original(state.elements)!, background: original(state.background)! });
      state.elements = prev.elements;
      state.background = prev.background;
      state.changeSeq++;
    },
    redo(state) {
      const next = state.future.pop();
      if (!next) return;
      state.past.push({ elements: original(state.elements)!, background: original(state.background)! });
      state.elements = next.elements;
      state.background = next.background;
      state.changeSeq++;
    },
  },
});

export const {
  boardLoaded,
  boardUnloaded,
  contentReplaced,
  elementsAdded,
  elementsUpdated,
  elementsRemoved,
  elementsReordered,
  backgroundChanged,
  boardCleared,
  undo,
  redo,
} = documentSlice.actions;
export default documentSlice.reducer;
