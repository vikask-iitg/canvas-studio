import { useAppDispatch, useAppSelector, useAppStore } from '@/app/hooks';
import { Modal } from '@/components/ui/Modal';
import { contentReplaced } from '../../slices/documentSlice';
import { conflictResolvedKeepMine, conflictResolvedTakeTheirs } from '../../slices/saveSlice';

/** Shown when a save is rejected because the board changed in another tab or device. */
export function ConflictDialog() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const conflict = useAppSelector((s) => s.editor.save.conflict);
  return (
    <Modal
      open={!!conflict}
      onOpenChange={() => undefined}
      title="This board changed somewhere else"
      description="It was edited in another tab or on another device since you opened it. Choose which version to keep."
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              if (!conflict) return;
              dispatch(contentReplaced({ elements: conflict.content.elements, background: conflict.background }));
              dispatch(conflictResolvedTakeTheirs({ seq: store.getState().editor.document.changeSeq }));
            }}
          >
            Load latest version
          </button>
          <button className="btn-primary" onClick={() => dispatch(conflictResolvedKeepMine())}>
            Keep my version
          </button>
        </>
      }
    />
  );
}
