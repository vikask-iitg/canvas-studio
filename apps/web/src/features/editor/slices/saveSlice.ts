import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Background, BoardContent } from '@canvas/shared';
import { boardLoaded } from './documentSlice';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offline' | 'error' | 'conflict';

export interface SaveState {
  version: number;
  status: SaveStatus;
  /** document.changeSeq covered by the last successful save. */
  savedSeq: number;
  lastEditedAt: string | null;
  conflict: { version: number; background: Background; content: BoardContent } | null;
}

const initialState: SaveState = { version: 1, status: 'saved', savedSeq: 0, lastEditedAt: null, conflict: null };

const saveSlice = createSlice({
  name: 'save',
  initialState,
  reducers: {
    saveStarted(state) {
      state.status = 'saving';
    },
    saveSucceeded(state, { payload }: PayloadAction<{ version: number; seq: number; updatedAt: string; stillDirty: boolean }>) {
      state.version = payload.version;
      state.savedSeq = payload.seq;
      state.lastEditedAt = payload.updatedAt;
      state.status = payload.stillDirty ? 'unsaved' : 'saved';
    },
    saveFailed(state, { payload }: PayloadAction<{ offline: boolean }>) {
      state.status = payload.offline ? 'offline' : 'error';
    },
    conflictDetected(state, { payload }: PayloadAction<NonNullable<SaveState['conflict']>>) {
      state.status = 'conflict';
      state.conflict = payload;
    },
    /** Keep local changes: rebase onto the server version so the next save overwrites it. */
    conflictResolvedKeepMine(state) {
      if (state.conflict) state.version = state.conflict.version;
      state.conflict = null;
      state.status = 'unsaved';
    },
    conflictResolvedTakeTheirs(state, { payload }: PayloadAction<{ seq: number }>) {
      if (state.conflict) state.version = state.conflict.version;
      state.conflict = null;
      state.savedSeq = payload.seq;
      state.status = 'saved';
    },
    markedUnsaved(state) {
      if (state.status === 'saved') state.status = 'unsaved';
    },
  },
  extraReducers: (b) => {
    b.addCase(boardLoaded, (_s, { payload }) => ({
      ...initialState,
      version: payload.version,
      lastEditedAt: payload.updatedAt,
      status: payload.dirty ? 'unsaved' : 'saved',
    }));
  },
});

export const { saveStarted, saveSucceeded, saveFailed, conflictDetected, conflictResolvedKeepMine, conflictResolvedTakeTheirs, markedUnsaved } =
  saveSlice.actions;
export default saveSlice.reducer;
