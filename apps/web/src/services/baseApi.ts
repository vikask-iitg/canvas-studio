import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type { AuthResponse } from '@canvas/shared';
import { credentialsReceived, loggedOut } from '@/features/auth/authSlice';
import type { RootState } from '@/app/store';

export const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

let refreshing: Promise<AuthResponse | null> | null = null;

/** POST /auth/refresh once, shared by every request that hit a 401 at the same time. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => (r.ok ? (r.json() as Promise<AuthResponse>) : null))
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

let starting: Promise<AuthResponse | null> | null = null;

/** Resumes this browser's session, or creates its guest account on the first visit. Shared by concurrent callers. */
export function startSession(): Promise<AuthResponse | null> {
  starting ??= (async () => {
    const existing = await refreshSession();
    if (existing) return existing;
    return fetch(`${API_BASE}/auth/guest`, { method: 'POST', credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<AuthResponse>) : null))
      .catch(() => null);
  })().finally(() => {
    starting = null;
  });
  return starting;
}

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  let result = await rawBaseQuery(args, api, extra);
  const url = typeof args === 'string' ? args : args.url;
  if (result.error?.status === 401 && !url.startsWith('/auth/')) {
    const session = await refreshSession();
    if (session) {
      api.dispatch(credentialsReceived(session));
      result = await rawBaseQuery(args, api, extra);
    } else {
      api.dispatch(loggedOut());
    }
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Me', 'Boards', 'Board', 'Templates', 'Share'],
  endpoints: () => ({}),
});

/** Pulls the server's { error: { code, message } } out of an RTK Query error. */
export function apiError(err: unknown): { status?: number | string; code?: string; message: string; body?: unknown } {
  const e = err as FetchBaseQueryError | undefined;
  if (e && 'status' in e) {
    const data = (e as { data?: { error?: { code?: string; message?: string } } }).data;
    return {
      status: e.status,
      code: data?.error?.code,
      message: data?.error?.message ?? (e.status === 'FETCH_ERROR' ? 'You appear to be offline' : 'Something went wrong'),
      body: data,
    };
  }
  return { message: (err as Error)?.message ?? 'Something went wrong' };
}
