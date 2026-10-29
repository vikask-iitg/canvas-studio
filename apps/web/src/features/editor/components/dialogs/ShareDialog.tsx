import { useState } from 'react';
import { Check, Copy, Link2, Link2Off } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/misc';
import { useCreateShareMutation, useGetShareQuery, useRevokeShareMutation } from '@/services/boardsApi';
import { toastShown } from '@/features/ui/uiSlice';
import { editorDialogOpened } from '../../slices/viewSlice';

export function ShareDialog({ boardId }: { boardId: string }) {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.editor.view.dialog === 'share');
  const { data: share, isLoading } = useGetShareQuery(boardId, { skip: !open });
  const [create, { isLoading: creating }] = useCreateShareMutation();
  const [revoke, { isLoading: revoking }] = useRevokeShareMutation();
  const [copied, setCopied] = useState(false);
  const url = share ? `${location.origin}/shared/${share.token}` : '';

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && dispatch(editorDialogOpened(null))}
      title="Share board"
      description="Anyone with the link can view this board. They can't edit it."
    >
      {isLoading ? (
        <Spinner />
      ) : share ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input readOnly aria-label="Share link" className="input font-mono text-xs" value={url} onFocus={(e) => e.target.select()} />
            <button className="btn-primary shrink-0" onClick={copy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            className="btn-ghost text-danger"
            disabled={revoking}
            onClick={() => revoke(boardId).unwrap().then(() => dispatch(toastShown('Link revoked — it no longer works', 'success')))}
          >
            <Link2Off size={16} /> Revoke link
          </button>
        </div>
      ) : (
        <button className="btn-primary" disabled={creating} onClick={() => create(boardId)}>
          <Link2 size={16} /> Create view-only link
        </button>
      )}
    </Modal>
  );
}
