import { useNavigate } from 'react-router-dom';
import { ErrorCode } from '@canvas/shared';
import { useAppDispatch } from '@/app/hooks';
import { apiError } from '@/services/baseApi';
import {
  useCreateBoardMutation,
  useDeleteBoardForeverMutation,
  useDuplicateBoardMutation,
  useRestoreBoardMutation,
  useTrashBoardMutation,
  useUpdateBoardMetaMutation,
} from '@/services/boardsApi';
import { openDialog, toastShown } from '@/features/ui/uiSlice';

/** Board CRUD with consistent error handling (plan-limit dialog, toasts). */
export function useBoardActions() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [createBoard, createState] = useCreateBoardMutation();
  const [duplicateBoard] = useDuplicateBoardMutation();
  const [updateMeta] = useUpdateBoardMetaMutation();
  const [trashBoard] = useTrashBoardMutation();
  const [restoreBoard] = useRestoreBoardMutation();
  const [deleteForever] = useDeleteBoardForeverMutation();

  const fail = (err: unknown) => {
    const e = apiError(err);
    if (e.code === ErrorCode.PlanLimit) dispatch(openDialog('planLimit'));
    else dispatch(toastShown(e.message, 'error'));
    return false;
  };

  return {
    creating: createState.isLoading,
    async create(templateId?: string) {
      try {
        const board = await createBoard(templateId ? { templateId } : {}).unwrap();
        navigate(`/board/${board.id}`);
        return true;
      } catch (e) {
        return fail(e);
      }
    },
    async duplicate(id: string, open = false) {
      try {
        const board = await duplicateBoard(id).unwrap();
        dispatch(toastShown(`Created “${board.title}”`, 'success'));
        if (open) navigate(`/board/${board.id}`);
        return true;
      } catch (e) {
        return fail(e);
      }
    },
    async rename(id: string, title: string) {
      try {
        await updateMeta({ id, title }).unwrap();
        return true;
      } catch (e) {
        return fail(e);
      }
    },
    async toggleStar(id: string, isStarred: boolean) {
      try {
        await updateMeta({ id, isStarred }).unwrap();
        return true;
      } catch (e) {
        return fail(e);
      }
    },
    async trash(id: string) {
      try {
        await trashBoard(id).unwrap();
        dispatch(toastShown('Moved to Trash. Boards are deleted for good after 30 days.'));
        return true;
      } catch (e) {
        return fail(e);
      }
    },
    async restore(id: string) {
      try {
        await restoreBoard(id).unwrap();
        dispatch(toastShown('Board restored', 'success'));
        return true;
      } catch (e) {
        return fail(e);
      }
    },
    async deleteForever(id: string) {
      try {
        await deleteForever(id).unwrap();
        dispatch(toastShown('Board deleted permanently'));
        return true;
      } catch (e) {
        return fail(e);
      }
    },
  };
}
