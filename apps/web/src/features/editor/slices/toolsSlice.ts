import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { FONT_HANDWRITTEN, STICKY_COLORS, type ShapeKind } from '@canvas/shared';

export type Tool = 'select' | 'hand' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'text' | 'image' | 'sticky' | 'connector';

export interface ToolsState {
  tool: Tool;
  shapeKind: ShapeKind;
  color: string;
  fill: string;
  strokeWidth: number;
  handDrawn: boolean;
  fontFamily: string;
  fontSize: number;
  stickyColor: string;
  snapToGrid: boolean;
}

const initialState: ToolsState = {
  tool: 'pen',
  shapeKind: 'rectangle',
  color: '#111827',
  fill: 'transparent',
  strokeWidth: 4,
  handDrawn: true,
  fontFamily: FONT_HANDWRITTEN,
  fontSize: 28,
  stickyColor: STICKY_COLORS[0],
  snapToGrid: false,
};

const toolsSlice = createSlice({
  name: 'tools',
  initialState,
  reducers: {
    toolSelected(state, { payload }: PayloadAction<Tool>) {
      state.tool = payload;
    },
    shapeKindSelected(state, { payload }: PayloadAction<ShapeKind>) {
      state.shapeKind = payload;
      state.tool = 'shape';
    },
    toolOptionsChanged(state, { payload }: PayloadAction<Partial<Omit<ToolsState, 'tool'>>>) {
      Object.assign(state, payload);
    },
  },
});

export const { toolSelected, shapeKindSelected, toolOptionsChanged } = toolsSlice.actions;
export default toolsSlice.reducer;
