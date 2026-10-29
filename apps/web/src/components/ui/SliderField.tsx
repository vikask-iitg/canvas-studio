import { useId } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange(v: number): void;
  className?: string;
}

/** Range slider with a synced numeric input (clamped to min/max). */
export function SliderField({ label, value, min, max, step = 1, unit, onChange, className }: Props) {
  const id = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm text-fg">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          className="range flex-1"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="flex h-9 w-[72px] items-center rounded-lg border border-line bg-surface px-2 focus-within:border-primary">
          <input
            aria-label={label ? `${label} value` : 'Value'}
            type="number"
            className="w-full min-w-0 bg-transparent text-right text-sm text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => e.target.value !== '' && onChange(clamp(Number(e.target.value)))}
          />
          {unit && <span className="ml-1 text-xs text-muted">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
