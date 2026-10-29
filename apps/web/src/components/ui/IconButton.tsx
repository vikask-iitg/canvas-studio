import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  active?: boolean;
  size?: 'sm' | 'md';
}

/** Square icon-only button; `label` is used for both aria-label and tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton({ label, children, active, size = 'md', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-fg transition-colors disabled:pointer-events-none disabled:opacity-40',
        size === 'md' ? 'h-9 w-9' : 'h-7 w-7',
        active ? 'bg-primary text-primary-fg' : 'hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
