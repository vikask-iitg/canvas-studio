import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Loader2 } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import { timeAgo } from '@/lib/time';

export function SaveStatus() {
  const { status, lastEditedAt } = useAppSelector((s) => s.editor.save);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const effective = !online ? 'offline' : status;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted" role="status" aria-live="polite">
      {effective === 'saved' && (
        <>
          <CheckCircle2 size={18} className="fill-success text-surface" />
          <span className="font-medium text-fg">Saved</span>
          {lastEditedAt && <span className="max-lg:hidden">Last edited {timeAgo(lastEditedAt)}</span>}
        </>
      )}
      {(effective === 'saving' || effective === 'unsaved') && (
        <>
          <Loader2 size={16} className="animate-spin text-primary" />
          <span className="font-medium text-fg">Saving…</span>
        </>
      )}
      {effective === 'offline' && (
        <>
          <CloudOff size={16} className="text-amber-500" />
          <span className="font-medium text-fg">Offline</span>
          <span className="max-lg:hidden">changes kept on this device</span>
        </>
      )}
      {(effective === 'error' || effective === 'conflict') && (
        <>
          <AlertTriangle size={16} className="text-danger" />
          <span className="font-medium text-danger">{effective === 'conflict' ? 'Needs attention' : 'Retrying save…'}</span>
        </>
      )}
    </div>
  );
}
