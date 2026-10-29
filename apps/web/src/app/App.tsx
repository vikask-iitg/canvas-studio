import { useCallback, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './hooks';
import { startSession } from '@/services/baseApi';
import { credentialsReceived, loggedOut, sessionCheckStarted } from '@/features/auth/authSlice';
import { setTheme } from '@/features/ui/uiSlice';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/Toaster';
import { BoardsPage } from '@/features/boards/pages/BoardsPage';
import { TemplatesPage } from '@/features/boards/pages/TemplatesPage';
import { EditorPage } from '@/features/editor/pages/EditorPage';
import { SharedBoardPage } from '@/features/shared/pages/SharedBoardPage';

/** Opens straight into the app: resumes this browser's session or creates a guest one. */
function useSessionBootstrap() {
  const dispatch = useAppDispatch();
  const start = useCallback(() => {
    dispatch(sessionCheckStarted());
    startSession().then((s) => dispatch(s ? credentialsReceived(s) : loggedOut()));
  }, [dispatch]);
  useEffect(start, [start]);
  return start;
}

/** Applies the theme class, persists it locally and adopts the account preference on sign-in. */
function useThemeSync() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const userTheme = useAppSelector((s) => s.auth.user?.theme);
  useEffect(() => {
    if (userTheme) dispatch(setTheme(userTheme));
  }, [userTheme, dispatch]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('cs-theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
}

export function App() {
  const retrySession = useSessionBootstrap();
  useThemeSync();
  return (
    <>
      <Routes>
        <Route path="/shared/:token" element={<SharedBoardPage />} />
        <Route
          element={
            <RequireAuth onRetry={retrySession}>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/boards" element={<BoardsPage />} />
          <Route path="/boards/:view" element={<BoardsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/trash" element={<BoardsPage trash />} />
          <Route path="/board/:id" element={<EditorPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/boards" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
