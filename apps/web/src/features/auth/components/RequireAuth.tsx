import type { ReactNode } from 'react';
import { CloudOff } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import { EmptyState, FullPageSpinner } from '@/components/ui/misc';

export function RequireAuth({ children, onRetry }: { children: ReactNode; onRetry(): void }) {
  const status = useAppSelector((s) => s.auth.status);
  if (status === 'idle' || status === 'checking') return <FullPageSpinner />;
  if (status === 'anonymous')
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={<CloudOff />}
          title="Can’t reach Canvas Studio"
          action={
            <button className="btn-primary" onClick={onRetry}>
              Try again
            </button>
          }
        >
          Check your connection and that the API server is running.
        </EmptyState>
      </div>
    );
  return <>{children}</>;
}
