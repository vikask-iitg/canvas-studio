import * as P from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?(open: boolean): void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Popover({ trigger, children, open, onOpenChange, align = 'start', side = 'bottom', className }: Props) {
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          align={align}
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className={cn('z-50 rounded-xl border border-line bg-surface p-3 shadow-pop animate-fade-in focus:outline-none', className)}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
