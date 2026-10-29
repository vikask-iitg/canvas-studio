import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ZOOM_MAX, ZOOM_MIN, type Background } from '@canvas/shared';
import { elementsRemoved, boardLoaded, undo, redo, boardCleared } from './documentSlice';

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export type EditorDialog = 'shortcuts' | 'share' | 'export' | 'rename' | null;

export interface ViewState {
  viewport: Viewport;
  selectedIds: string[];
  editingId: string | null;
  backgroundPanelOpen: boolean;
  /** Live preview while the background panel is being edited; null when not previewing. */
  backgroundDraft: Background | null;
  dialog: EditorDialog;
  readOnly: boolean;
  /** Disables viewport culling so every node exists for export. */
  exporting: boolean;
}

const initialState: ViewState = {
  viewport: { x: 0, y: 0, scale: 1 },
  selectedIds: [],
  editingId: null,
  backgroundPanelOpen: false,
  backgroundDraft: null,
  dialog: null,
  readOnly: false,
  exporting: false,
};

export const clampZoom = (s: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));

const viewSlice = createSlice({
  name: 'view',
  initialState,
  reducers: {
    viewportChanged(state, { payload }: PayloadAction<Viewport>) {
      state.viewport = { ...payload, scale: clampZoom(payload.scale) };
    },
    selectionChanged(state, { payload }: PayloadAction<string[]>) {
      state.selectedIds = payload;
      if (state.editingId && !payload.includes(state.editingId)) state.editingId = null;
    },
    editingStarted(state, { payload }: PayloadAction<string | null>) {
      state.editingId = payload;
    },
    backgroundPanelToggled(state, { payload }: PayloadAction<boolean | undefined>) {
      state.backgroundPanelOpen = payload ?? !state.backgroundPanelOpen;
      if (!state.backgroundPanelOpen) state.backgroundDraft = null;
    },
    backgroundPreviewed(state, { payload }: PayloadAction<Background | null>) {
      state.backgroundDraft = payload;
    },
    editorDialogOpened(state, { payload }: PayloadAction<EditorDialog>) {
      state.dialog = payload;
    },
    readOnlySet(state, { payload }: PayloadAction<boolean>) {
      state.readOnly = payload;
    },
    exportingSet(state, { payload }: PayloadAction<boolean>) {
      state.exporting = payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(boardLoaded, (state) => ({ ...initialState, readOnly: state.readOnly }));
    b.addCase(elementsRemoved, (state, { payload }) => {
      state.selectedIds = state.selectedIds.filter((id) => !payload.includes(id));
      if (state.editingId && payload.includes(state.editingId)) state.editingId = null;
    });
    const clearSelection = (state: ViewState) => {
      state.selectedIds = [];
      state.editingId = null;
    };
    b.addCase(undo, clearSelection).addCase(redo, clearSelection).addCase(boardCleared, clearSelection);
  },
});

export const {
  viewportChanged,
  selectionChanged,
  editingStarted,
  backgroundPanelToggled,
  backgroundPreviewed,
  editorDialogOpened,
  readOnlySet,
  exportingSet,
} = viewSlice.actions;
export default viewSlice.reducer;
