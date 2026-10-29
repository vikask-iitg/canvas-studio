import type { MeResponse, Theme } from '@canvas/shared';
import { baseApi } from './baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    me: b.query<MeResponse, void>({ query: () => '/me', providesTags: ['Me'] }),
    updateMe: b.mutation<MeResponse, { name?: string; theme?: Theme }>({
      query: (body) => ({ url: '/me', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),
  }),
});

export const { useMeQuery, useUpdateMeMutation } = authApi;
