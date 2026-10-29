import { useEffect, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Moon, Sun } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/misc';
import { useMeQuery, useUpdateMeMutation } from '@/services/authApi';
import { apiError } from '@/services/baseApi';
import { cn } from '@/lib/cn';
import { userUpdated } from '@/features/auth/authSlice';
import { closeDialog, openDialog, setTheme, toastShown } from '@/features/ui/uiSlice';

export function AccountDialog() {
  const dispatch = useAppDispatch();
  const dialog = useAppSelector((s) => s.ui.dialog);
  const user = useAppSelector((s) => s.auth.user);
  const theme = useAppSelector((s) => s.ui.theme);
  const { data: me } = useMeQuery(undefined, { skip: !user });
  const [updateMe, { isLoading }] = useUpdateMeMutation();
  const [name, setName] = useState(user?.name ?? '');
  const open = dialog === 'profile' || dialog === 'settings';
  useEffect(() => {
    if (open) setName(user?.name ?? '');
  }, [open, user?.name]);
  if (!user) return null;

  const saveName = async () => {
    try {
      const res = await updateMe({ name: name.trim() }).unwrap();
      dispatch(userUpdated(res.user));
      dispatch(toastShown('Profile updated', 'success'));
    } catch (e) {
      dispatch(toastShown(apiError(e).message, 'error'));
    }
  };

  const chooseTheme = (t: 'light' | 'dark') => {
    dispatch(setTheme(t));
    updateMe({ theme: t });
  };

  const trigger = (v: string, label: string) => (
    <Tabs.Trigger
      value={v}
      className="flex-1 rounded-lg py-1.5 text-sm text-muted data-[state=active]:bg-surface data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-sm"
    >
      {label}
    </Tabs.Trigger>
  );

  return (
    <Modal open={open} onOpenChange={(o) => !o && dispatch(closeDialog())} title="Account">
      <Tabs.Root value={dialog === 'settings' ? 'settings' : 'profile'} onValueChange={(v) => dispatch(openDialog(v as 'profile' | 'settings'))}>
        <Tabs.List className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
          {trigger('profile', 'Profile')}
          {trigger('settings', 'Settings')}
        </Tabs.List>
        <Tabs.Content value="profile" className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} url={user.avatarUrl} size={56} />
            <div>
              <p className="font-semibold">{user.name}</p>
              {!user.email.endsWith('@guest.local') && <p className="text-sm text-muted">{user.email}</p>}
              <p className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium capitalize text-primary">{user.plan} plan</p>
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Display name</span>
            <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          {me?.usage && (
            <p className="text-sm text-muted">
              {me.usage.boards} active board{me.usage.boards === 1 ? '' : 's'}
              {me.usage.limit !== null && ` of ${me.usage.limit} on the free plan`}
            </p>
          )}
          <div className="flex justify-end">
            <button className="btn-primary" disabled={isLoading || !name.trim() || name.trim() === user.name} onClick={saveName}>
              Save changes
            </button>
          </div>
        </Tabs.Content>
        <Tabs.Content value="settings" className="space-y-3">
          <p className="text-sm font-medium">Theme</p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['light', 'Light', Sun],
                ['dark', 'Dark', Moon],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseTheme(value)}
                aria-pressed={theme === value}
                className={cn('flex items-center gap-3 rounded-xl border p-4 text-sm', theme === value ? 'border-primary bg-primary-soft text-primary' : 'border-line hover:bg-surface-2')}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Your theme follows you to every device you sign in on.</p>
        </Tabs.Content>
      </Tabs.Root>
    </Modal>
  );
}
