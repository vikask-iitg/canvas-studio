import { useEffect, useState } from 'react';
import { Pipette } from 'lucide-react';

interface EyeDropperCtor {
  new (): { open(): Promise<{ sRGBHex: string }> };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function normalize(v: string) {
  let s = v.trim();
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return s.toUpperCase();
}

/** Swatch (native picker) + hex input + eyedropper where the browser supports it. */
export function ColorField({ value, onChange, label }: { value: string; onChange(hex: string): void; label: string }) {
  const [text, setText] = useState(value.toUpperCase());
  useEffect(() => setText(value.toUpperCase()), [value]);
  const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

  const commit = (v: string) => {
    const hex = normalize(v);
    if (HEX.test(hex)) onChange(hex);
    else setText(value.toUpperCase());
  };

  return (
    <div className="flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-2 focus-within:border-primary">
      <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line" style={{ background: value }}>
        <input
          type="color"
          aria-label={`${label} picker`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={HEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      </label>
      <input
        aria-label={`${label} hex`}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg outline-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        maxLength={7}
      />
      {EyeDropper && (
        <button
          type="button"
          aria-label={`Pick ${label.toLowerCase()} from screen`}
          title="Eyedropper"
          className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          onClick={() =>
            new EyeDropper()
              .open()
              .then((r) => onChange(r.sRGBHex.toUpperCase()))
              .catch(() => undefined)
          }
        >
          <Pipette size={16} />
        </button>
      )}
    </div>
  );
}
