import * as DM from '@radix-ui/react-dropdown-menu';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export const MenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DM.Content>>(function MenuContent(
  { className, sideOffset = 6, align = 'end', ...props },
  ref,
) {
  return (
    <DM.Portal>
      <DM.Content ref={ref} sideOffset={sideOffset} align={align} className={cn('menu', className)} {...props} />
    </DM.Portal>
  );
});

interface ItemProps extends ComponentPropsWithoutRef<typeof DM.Item> {
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
}

export function MenuItem({ icon, shortcut, danger, children, className, ...props }: ItemProps) {
  return (
    <DM.Item className={cn('menu-item', danger && 'text-danger', className)} {...props}>
      {icon && <span className="flex w-4 justify-center text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-muted">{shortcut}</span>}
    </DM.Item>
  );
}

export function MenuCheckbox({ checked, onCheckedChange, children }: { checked: boolean; onCheckedChange(v: boolean): void; children: ReactNode }) {
  return (
    <DM.CheckboxItem checked={checked} onCheckedChange={onCheckedChange} onSelect={(e) => e.preventDefault()} className="menu-item">
      <span className={cn('flex h-4 w-4 items-center justify-center rounded border', checked ? 'border-primary bg-primary text-primary-fg' : 'border-line')}>
        {checked && '✓'}
      </span>
      <span className="flex-1">{children}</span>
    </DM.CheckboxItem>
  );
}

export const MenuSeparator = () => <DM.Separator className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <DM.Label className="px-2.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">{children}</DM.Label>
);
