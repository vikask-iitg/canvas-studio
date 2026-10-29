import type { Board, BoardList, BoardSort, BoardSummary, BoardView, ShareLink, SharedBoard, Template, UpdateBoardInput } from '@canvas/shared';
import { baseApi } from './baseApi';

export interface ListBoardsArgs {
  view: BoardView;
  q?: string;
  sort?: BoardSort;
}

type UpdateResult = BoardSummary & { version: number };

export const boardsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listBoards: b.query<BoardList, ListBoardsArgs>({
      query: ({ view, q = '', sort = 'recent' }) => ({ url: '/boards', params: { view, q, sort, pageSize: 100 } }),
      providesTags: ['Boards'],
    }),
    getBoard: b.query<Board, string>({
      query: (id) => `/boards/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Board', id }],
      keepUnusedDataFor: 0,
    }),
    createBoard: b.mutation<Board, { title?: string; templateId?: string }>({
      query: (body) => ({ url: '/boards', method: 'POST', body }),
      invalidatesTags: ['Boards', 'Me'],
    }),
    /** Metadata edits (title, star). Content saves go through saveBoardContent. */
    updateBoardMeta: b.mutation<UpdateResult, { id: string; title?: string; isStarred?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/boards/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Boards'],
      async onQueryStarted({ id, ...patch }, { dispatch, queryFulfilled, getState }) {
        // Optimistically update every cached list containing this board, and the open board.
        const undos = boardsApi.util
          .selectInvalidatedBy(getState(), ['Boards'])
          .filter((e) => e.endpointName === 'listBoards')
          .map((e) =>
            dispatch(
              boardsApi.util.updateQueryData('listBoards', e.originalArgs as ListBoardsArgs, (draft) => {
                const item = draft.items.find((i) => i.id === id);
                if (item) Object.assign(item, patch);
              }),
            ),
          );
        undos.push(dispatch(boardsApi.util.updateQueryData('getBoard', id, (draft) => void Object.assign(draft, patch))));
        try {
          await queryFulfilled;
        } catch {
          undos.forEach((u) => u.undo());
        }
      },
    }),
    saveBoardContent: b.mutation<UpdateResult, { id: string } & Pick<UpdateBoardInput, 'content' | 'background' | 'version'>>({
      query: ({ id, ...body }) => ({ url: `/boards/${id}`, method: 'PATCH', body }),
    }),
    duplicateBoard: b.mutation<Board, string>({
      query: (id) => ({ url: `/boards/${id}/duplicate`, method: 'POST' }),
      invalidatesTags: ['Boards', 'Me'],
    }),
    trashBoard: b.mutation<void, string>({
      query: (id) => ({ url: `/boards/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Boards', 'Me'],
    }),
    restoreBoard: b.mutation<BoardSummary, string>({
      query: (id) => ({ url: `/boards/${id}/restore`, method: 'POST' }),
      invalidatesTags: ['Boards', 'Me'],
    }),
    deleteBoardForever: b.mutation<void, string>({
      query: (id) => ({ url: `/boards/${id}/permanent`, method: 'DELETE' }),
      invalidatesTags: ['Boards', 'Me'],
    }),
    uploadThumbnail: b.mutation<{ thumbnailUrl: string }, { id: string; dataUrl: string }>({
      query: ({ id, dataUrl }) => ({ url: `/boards/${id}/thumbnail`, method: 'POST', body: { dataUrl } }),
      invalidatesTags: ['Boards'],
    }),
    templates: b.query<Template[], void>({ query: () => '/templates', providesTags: ['Templates'], keepUnusedDataFor: 3600 }),
    getShare: b.query<ShareLink | null, string>({ query: (id) => `/boards/${id}/share`, providesTags: ['Share'] }),
    createShare: b.mutation<ShareLink, string>({
      query: (id) => ({ url: `/boards/${id}/share`, method: 'POST' }),
      invalidatesTags: ['Share'],
    }),
    revokeShare: b.mutation<void, string>({
      query: (id) => ({ url: `/boards/${id}/share`, method: 'DELETE' }),
      invalidatesTags: ['Share'],
    }),
    sharedBoard: b.query<SharedBoard, string>({ query: (token) => `/shared/${token}` }),
  }),
});

export const {
  useListBoardsQuery,
  useGetBoardQuery,
  useCreateBoardMutation,
  useUpdateBoardMetaMutation,
  useSaveBoardContentMutation,
  useDuplicateBoardMutation,
  useTrashBoardMutation,
  useRestoreBoardMutation,
  useDeleteBoardForeverMutation,
  useUploadThumbnailMutation,
  useTemplatesQuery,
  useGetShareQuery,
  useCreateShareMutation,
  useRevokeShareMutation,
  useSharedBoardQuery,
} = boardsApi;
