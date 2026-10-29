import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useTemplatesQuery } from '@/services/boardsApi';
import { toggleTemplateStrip } from '@/features/ui/uiSlice';
import { useBoardActions } from '../hooks/useBoardActions';
import { TemplatePreview } from './TemplatePreview';

export function TemplateStrip() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.templateStripOpen);
  const { data: templates } = useTemplatesQuery();
  const actions = useBoardActions();

  return (
    <section className="shrink-0 border-t border-line bg-surface px-4 pb-3 pt-2 max-md:hidden" aria-label="Start with a template">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Start with a template</h2>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg"
          onClick={() => dispatch(toggleTemplateStrip())}
          aria-expanded={open}
        >
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
          {(templates ?? []).map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={actions.creating}
              onClick={() => actions.create(t.id)}
              className="group flex w-[136px] shrink-0 flex-col items-center gap-1.5 text-xs font-medium text-fg"
            >
              <span className="flex h-[72px] w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-white transition group-hover:border-primary group-hover:shadow-card">
                {t.id === 'tpl_blank' ? <Plus size={20} className="text-primary" /> : <TemplatePreview background={t.background} elements={t.content.elements} />}
              </span>
              {t.name}
            </button>
          ))}
          {!templates && Array.from({ length: 10 }, (_, i) => <span key={i} className="h-[92px] w-[136px] shrink-0 animate-pulse rounded-lg bg-surface-2" />)}
        </div>
      )}
    </section>
  );
}
