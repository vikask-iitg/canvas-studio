import { useNavigate } from 'react-router-dom';
import { Check, Crown } from 'lucide-react';
import { FREE_BOARD_LIMIT } from '@canvas/shared';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Modal } from '@/components/ui/Modal';
import { closeDialog, openDialog, toastShown } from '@/features/ui/uiSlice';

const FEATURES = {
  free: [`Up to ${FREE_BOARD_LIMIT} boards`, 'All tools and backgrounds', '10 templates', 'PNG, SVG and PDF export', 'View-only share links'],
  pro: ['Unlimited boards', 'More image storage', 'Version history', 'Team workspaces (soon)', 'Priority support'],
};

export function UpgradeDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.dialog === 'upgrade');
  const plan = useAppSelector((s) => s.auth.user?.plan);
  return (
    <Modal open={open} onOpenChange={(o) => !o && dispatch(closeDialog())} title="Upgrade to Pro" description="More room for your ideas." className="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        {(['free', 'pro'] as const).map((p) => (
          <div key={p} className={p === 'pro' ? 'rounded-2xl border-2 border-primary p-5' : 'rounded-2xl border border-line p-5'}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold capitalize">
                {p === 'pro' && <Crown size={18} className="text-amber-500" />}
                {p}
              </h3>
              {plan === p && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">Current</span>}
            </div>
            <p className="mt-2 text-2xl font-bold">{p === 'free' ? '$0' : '$8'}<span className="text-sm font-normal text-muted"> / month</span></p>
            <ul className="mt-4 space-y-2 text-sm">
              {FEATURES[p].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check size={16} className="text-success" /> {f}
                </li>
              ))}
            </ul>
            {p === 'pro' && (
              <button
                className="btn-primary mt-5 w-full"
                onClick={() => {
                  dispatch(closeDialog());
                  dispatch(toastShown('Pro is coming soon — we’ll let you know as soon as billing opens.', 'success'));
                }}
              >
                Notify me when Pro launches
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function PlanLimitDialog() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const open = useAppSelector((s) => s.ui.dialog === 'planLimit');
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && dispatch(closeDialog())}
      title="You’ve reached the free plan limit"
      description={`Free accounts can have up to ${FREE_BOARD_LIMIT} active boards. Move boards you no longer need to Trash, or upgrade for unlimited boards.`}
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              dispatch(closeDialog());
              navigate('/boards');
            }}
          >
            Manage boards
          </button>
          <button className="btn-primary" onClick={() => dispatch(openDialog('upgrade'))}>
            <Crown size={16} /> Upgrade
          </button>
        </>
      }
    />
  );
}
