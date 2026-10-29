import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@/services/baseApi';
import authReducer from '@/features/auth/authSlice';
import uiReducer from '@/features/ui/uiSlice';
import { editorReducer } from '@/features/editor/slices';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    editor: editorReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefault) =>
    getDefault({
      // Board content can hold thousands of elements; deep dev checks on every pointer move are too slow.
      immutableCheck: false,
      serializableCheck: false,
    }).concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
