import { useEffect } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { toastDismissed, type Toast } from '@/features/ui/uiSlice';
import { cn } from '@/lib/cn';

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(toastDismissed(toast.id)), toast.tone === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [dispatch, toast]);
  const Icon = toast.tone === 'error' ? XCircle : toast.tone === 'success' ? CheckCircle2 : Info;
  return (
    <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-fg shadow-pop animate-slide-in">
      <Icon size={18} className={cn(toast.tone === 'error' ? 'text-danger' : toast.tone === 'success' ? 'text-success' : 'text-primary')} />
      <span className="flex-1">{toast.message}</span>
      <button aria-label="Dismiss" className="text-muted hover:text-fg" onClick={() => dispatch(toastDismissed(toast.id))}>
        <X size={16} />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2" aria-live="polite">
      {toasts.slice(-4).map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
