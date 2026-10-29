import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthResponse, User } from '@canvas/shared';

type Status = 'idle' | 'checking' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  accessToken: string | null;
  user: User | null;
}

const initialState: AuthState = { status: 'idle', accessToken: null, user: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionCheckStarted(state) {
      state.status = 'checking';
    },
    credentialsReceived(state, { payload }: PayloadAction<AuthResponse>) {
      state.status = 'authenticated';
      state.accessToken = payload.accessToken;
      state.user = payload.user;
    },
    userUpdated(state, { payload }: PayloadAction<User>) {
      state.user = payload;
    },
    loggedOut(state) {
      state.status = 'anonymous';
      state.accessToken = null;
      state.user = null;
    },
  },
});

export const { sessionCheckStarted, credentialsReceived, userUpdated, loggedOut } = authSlice.actions;
export default authSlice.reducer;
