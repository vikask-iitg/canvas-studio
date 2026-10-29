import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Theme } from '@canvas/shared';

export type AppDialog = 'upgrade' | 'planLimit' | 'profile' | 'settings' | null;

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error' | 'success';
}

interface UiState {
  sidebarCollapsed: boolean;
  templateStripOpen: boolean;
  theme: Theme;
  dialog: AppDialog;
  toasts: Toast[];
}

const readTheme = (): Theme => {
  try {
    return localStorage.getItem('cs-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const initialState: UiState = {
  sidebarCollapsed: typeof window !== 'undefined' && window.innerWidth < 1280,
  templateStripOpen: true,
  theme: readTheme(),
  dialog: null,
  toasts: [],
};

let toastId = 0;

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, { payload }: PayloadAction<boolean>) {
      state.sidebarCollapsed = payload;
    },
    toggleTemplateStrip(state) {
      state.templateStripOpen = !state.templateStripOpen;
    },
    setTheme(state, { payload }: PayloadAction<Theme>) {
      state.theme = payload;
    },
    openDialog(state, { payload }: PayloadAction<AppDialog>) {
      state.dialog = payload;
    },
    closeDialog(state) {
      state.dialog = null;
    },
    toastShown: {
      reducer(state, { payload }: PayloadAction<Toast>) {
        state.toasts.push(payload);
      },
      prepare(message: string, tone: Toast['tone'] = 'info') {
        return { payload: { id: ++toastId, message, tone } };
      },
    },
    toastDismissed(state, { payload }: PayloadAction<number>) {
      state.toasts = state.toasts.filter((t) => t.id !== payload);
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed, toggleTemplateStrip, setTheme, openDialog, closeDialog, toastShown, toastDismissed } =
  uiSlice.actions;
export default uiSlice.reducer;
