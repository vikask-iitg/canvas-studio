import { useEffect, useMemo, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { BACKGROUND_TYPES, DEFAULT_BACKGROUND, type Background, type BackgroundType } from '@canvas/shared';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { ColorField } from '@/components/ui/ColorField';
import { SliderField } from '@/components/ui/SliderField';
import { Spinner } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { toastShown } from '@/features/ui/uiSlice';
import { uploadImage } from '@/services/uploads';
import { backgroundChanged } from '../../slices/documentSlice';
import { backgroundPanelToggled, backgroundPreviewed } from '../../slices/viewSlice';
import { boardToSvg } from '../../canvas/svg';
import { BACKGROUND_PRESETS, PAPER_COLORS } from './presets';

const TYPE_LABELS: Record<BackgroundType, string> = {
  plain: 'Plain',
  grid: 'Grid',
  dots: 'Dots',
  lined: 'Lined',
  isometric: 'Isometric',
  graph: 'Graph',
  texture: 'Texture',
  image: 'Image',
};

const PATTERN_TYPES: BackgroundType[] = ['grid', 'dots', 'lined', 'isometric', 'graph'];

/** Small SVG thumbnail of a background, rendered with the same geometry as the canvas. */
export function BackgroundSwatch({ bg, className }: { bg: Background; className?: string }) {
  const src = useMemo(() => {
    const preview: Background = { ...bg, grid: { ...bg.grid, spacing: Math.max(8, Math.min(bg.grid.spacing, 14)), opacity: Math.max(bg.grid.opacity, 0.5) } };
    const svg = boardToSvg(preview, [], { bounds: { x: 0, y: 0, width: 96, height: 64 } });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [bg]);
  return <img src={src} alt="" className={cn('h-full w-full object-cover', className)} draggable={false} />;
}

export function BackgroundPanel() {
  const dispatch = useAppDispatch();
  const applied = useAppSelector((s) => s.editor.document.background);
  const draftState = useAppSelector((s) => s.editor.view.backgroundDraft);
  const boardId = useAppSelector((s) => s.editor.document.boardId);
  const draft = draftState ?? applied;
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = draftState !== null && JSON.stringify(draftState) !== JSON.stringify(applied);

  const update = (patch: Partial<Background>) => dispatch(backgroundPreviewed({ ...draft, ...patch }));
  const updateGrid = (patch: Partial<Background['grid']>) => update({ grid: { ...draft.grid, ...patch } });

  const close = () => dispatch(backgroundPanelToggled(false));
  const apply = () => {
    dispatch(backgroundChanged(draft));
    dispatch(backgroundPreviewed(null));
    dispatch(toastShown('Background applied', 'success'));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const img = await uploadImage(file, boardId ?? undefined);
      update({ type: 'image', imageUrl: img.url });
    } catch (e) {
      dispatch(toastShown((e as Error).message, 'error'));
    } finally {
      setUploading(false);
    }
  };

  const tabTrigger = (value: string, label: string) => (
    <Tabs.Trigger
      value={value}
      className="flex-1 rounded-lg py-1.5 text-sm text-muted transition-colors data-[state=active]:bg-surface data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-sm"
    >
      {label}
    </Tabs.Trigger>
  );

  return (
    <aside
      className="flex h-full w-80 shrink-0 flex-col rounded-xl border border-line bg-surface shadow-card animate-slide-in max-xl:absolute max-xl:bottom-3 max-xl:right-3 max-xl:top-3 max-xl:z-20 max-xl:h-auto max-xl:shadow-pop max-sm:inset-x-2 max-sm:w-auto"
      aria-label="Background settings"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-base font-semibold">Background Settings</h2>
        <button type="button" onClick={close} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close background settings">
          <X size={18} />
        </button>
      </div>

      <Tabs.Root defaultValue="style" className="flex min-h-0 flex-1 flex-col">
        <Tabs.List className="mx-4 flex gap-1 rounded-xl bg-surface-2 p-1" aria-label="Background options">
          {tabTrigger('style', 'Style')}
          {tabTrigger('color', 'Color')}
          {tabTrigger('image', 'Image')}
          {tabTrigger('presets', 'Presets')}
        </Tabs.List>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <Tabs.Content value="style" className="space-y-6 focus:outline-none">
            <section>
              <h3 className="label mb-3">Background Type</h3>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUND_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => (t === 'image' && !draft.imageUrl ? fileRef.current?.click() : update({ type: t }))}
                    aria-pressed={draft.type === t}
                    className={cn(
                      'group flex flex-col items-center gap-1 rounded-lg border p-1 text-[11px] transition-colors',
                      draft.type === t ? 'border-primary bg-primary-soft text-primary' : 'border-line hover:border-primary/40',
                    )}
                  >
                    <span className="block h-12 w-full overflow-hidden rounded-md border border-line/60">
                      {t === 'image' ? (
                        draft.imageUrl ? (
                          <img src={draft.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center bg-gradient-to-br from-sky-200 via-emerald-100 to-amber-100 text-muted">
                            <ImagePlus size={16} />
                          </span>
                        )
                      ) : (
                        <BackgroundSwatch bg={{ ...draft, type: t, color: draft.type === 'image' ? '#FFFFFF' : draft.color }} />
                      )}
                    </span>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="label mb-2">Background Color</h3>
              <ColorField label="Background color" value={draft.color} onChange={(color) => update({ color })} />
            </section>

            {PATTERN_TYPES.includes(draft.type) && (
              <section className="space-y-4">
                <h3 className="label">Grid Settings</h3>
                <SliderField label="Spacing" min={8} max={64} unit="px" value={draft.grid.spacing} onChange={(spacing) => updateGrid({ spacing })} />
                <div className="space-y-2">
                  <span className="block text-sm">Line Color</span>
                  <ColorField label="Line color" value={draft.grid.lineColor} onChange={(lineColor) => updateGrid({ lineColor })} />
                </div>
                <SliderField label={draft.type === 'dots' ? 'Dot Size' : 'Line Width'} min={1} max={4} step={0.5} unit="px" value={draft.grid.lineWidth} onChange={(lineWidth) => updateGrid({ lineWidth })} />
                <SliderField
                  label="Opacity"
                  min={0}
                  max={100}
                  unit="%"
                  value={Math.round(draft.grid.opacity * 100)}
                  onChange={(v) => updateGrid({ opacity: v / 100 })}
                />
              </section>
            )}
          </Tabs.Content>

          <Tabs.Content value="color" className="space-y-5 focus:outline-none">
            <section>
              <h3 className="label mb-3">Paper colors</h3>
              <div className="grid grid-cols-5 gap-2">
                {PAPER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Background ${c}`}
                    onClick={() => update({ color: c })}
                    className={cn('h-11 rounded-lg border border-line', draft.color === c && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </section>
            <section>
              <h3 className="label mb-2">Custom</h3>
              <ColorField label="Background color" value={draft.color} onChange={(color) => update({ color })} />
            </section>
          </Tabs.Content>

          <Tabs.Content value="image" className="space-y-4 focus:outline-none">
            <div className="overflow-hidden rounded-xl border border-dashed border-line">
              {draft.imageUrl ? (
                <img src={draft.imageUrl} alt="Background" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted">
                  <ImagePlus size={24} />
                  PNG, JPG, SVG or GIF up to 10 MB
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Spinner className="h-4 w-4" /> : <ImagePlus size={16} />}
                {draft.imageUrl ? 'Replace image' : 'Upload image'}
              </button>
              {draft.imageUrl && (
                <button type="button" className="btn-secondary" aria-label="Remove image" onClick={() => update({ imageUrl: null, type: draft.type === 'image' ? 'plain' : draft.type })}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {draft.imageUrl && (
              <div>
                <h3 className="label mb-2">Fit</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(['cover', 'tile'] as const).map((fit) => (
                    <button
                      key={fit}
                      type="button"
                      onClick={() => update({ imageFit: fit, type: 'image' })}
                      className={cn('rounded-lg border py-2 text-sm capitalize', draft.imageFit === fit && draft.type === 'image' ? 'border-primary bg-primary-soft text-primary' : 'border-line')}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Tabs.Content>

          <Tabs.Content value="presets" className="grid grid-cols-2 gap-3 focus:outline-none">
            {BACKGROUND_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => dispatch(backgroundPreviewed({ ...p.background, imageUrl: draft.imageUrl }))}
                className="overflow-hidden rounded-xl border border-line text-left text-sm transition-colors hover:border-primary"
              >
                <span className="block h-16">
                  <BackgroundSwatch bg={p.background} />
                </span>
                <span className="block px-2.5 py-1.5 font-medium">{p.name}</span>
              </button>
            ))}
          </Tabs.Content>
        </div>
      </Tabs.Root>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/gif" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />

      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <span className="flex-1 text-sm font-semibold">{dirty ? 'Preview' : 'Applied'}</span>
        <button type="button" className="btn-secondary" title="Reset to the default plain background" onClick={() => dispatch(backgroundPreviewed({ ...DEFAULT_BACKGROUND }))}>
          Reset
        </button>
        <button type="button" className="btn-primary px-5" onClick={apply} disabled={!dirty}>
          Apply
        </button>
      </div>
    </aside>
  );
}
