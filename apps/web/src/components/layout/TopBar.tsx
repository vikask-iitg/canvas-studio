import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Crown, Menu as MenuIcon, Moon, Search, Settings, Sun, User as UserIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useListBoardsQuery } from '@/services/boardsApi';
import { useUpdateMeMutation } from '@/services/authApi';
import { Avatar } from '@/components/ui/misc';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { IconButton } from '@/components/ui/IconButton';
import { timeAgo } from '@/lib/time';
import { useDebounced } from '@/lib/useDebounced';
import { cn } from '@/lib/cn';
import { openDialog, setTheme, toggleSidebar } from '@/features/ui/uiSlice';

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const dq = useDebounced(q.trim(), 200);
  const { data, isFetching } = useListBoardsQuery({ view: 'all', q: dq, sort: 'recent' }, { skip: !dq });
  const results = dq ? (data?.items ?? []).slice(0, 8) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (id: string) => {
    navigate(`/board/${id}`);
    setQ('');
    setOpen(false);
    ref.current?.blur();
  };

  return (
    <div className="relative w-64 max-lg:w-44 max-sm:hidden">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        className="input h-10 bg-surface-2 pl-9 pr-12"
        placeholder="Search…"
        aria-label="Search all boards"
        role="combobox"
        aria-expanded={open && !!dq}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
          if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          if (e.key === 'Enter' && results[active]) go(results[active].id);
          if (e.key === 'Escape') ref.current?.blur();
        }}
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 text-[10px] text-muted max-lg:hidden">⌘K</kbd>
      {open && dq && (
        <div className="menu absolute right-0 top-12 w-80" role="listbox">
          {results.map((b, i) => (
            <button
              key={b.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(b.id)}
              className={cn('menu-item', i === active && 'bg-surface-2')}
            >
              <span className="flex-1 truncate">{b.title}</span>
              <span className="text-xs text-muted">{timeAgo(b.updatedAt)}</span>
            </button>
          ))}
          {!results.length && <p className="px-3 py-4 text-sm text-muted">{isFetching ? 'Searching…' : `No boards match “${dq}”`}</p>}
        </div>
      )}
    </div>
  );
}

function NotificationsBell() {
  return (
    <Popover
      align="end"
      className="w-72"
      trigger={
        <IconButton label="Notifications" className="rounded-full border border-line">
          <Bell size={18} />
        </IconButton>
      }
    >
      <p className="text-sm font-semibold">Notifications</p>
      <p className="mt-6 pb-4 text-center text-sm text-muted">You’re all caught up.</p>
    </Popover>
  );
}

function ThemeToggle() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const signedIn = useAppSelector((s) => s.auth.status === 'authenticated');
  const [updateMe] = useUpdateMeMutation();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <IconButton
      label={`Switch to ${next} theme`}
      onClick={() => {
        dispatch(setTheme(next));
        if (signedIn) updateMe({ theme: next });
      }}
    >
      {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
    </IconButton>
  );
}

function UserMenu() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return null;
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-2" aria-label="Account menu">
          <Avatar name={user.name} url={user.avatarUrl} size={34} />
          <span className="text-sm font-medium max-lg:hidden">{user.name.split(' ')[0]}</span>
          <ChevronDown size={16} className="text-muted" />
        </button>
      </MenuTrigger>
      <MenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={user.name} url={user.avatarUrl} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.plan === 'free' ? 'Free plan' : 'Pro plan'}</p>
          </div>
        </div>
        <MenuSeparator />
        <MenuItem icon={<UserIcon />} onSelect={() => dispatch(openDialog('profile'))}>
          Profile
        </MenuItem>
        <MenuItem icon={<Settings />} onSelect={() => dispatch(openDialog('settings'))}>
          Settings
        </MenuItem>
        {user.plan === 'free' && (
          <MenuItem icon={<Crown />} onSelect={() => dispatch(openDialog('upgrade'))}>
            Upgrade to Pro
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}

/** 64px app header: page-specific content on the left, global controls on the right. */
export function TopBar({ left }: { left?: ReactNode }) {
  const dispatch = useAppDispatch();
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4">
      <IconButton label="Toggle sidebar" onClick={() => dispatch(toggleSidebar())}>
        <MenuIcon size={20} />
      </IconButton>
      <div className="min-w-0 flex-1">{left}</div>
      <GlobalSearch />
      <NotificationsBell />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
