import { TopBar } from '@/components/layout/TopBar';
import { useTemplatesQuery } from '@/services/boardsApi';
import { TemplatePreview } from '../components/TemplatePreview';
import { useBoardActions } from '../hooks/useBoardActions';

const CATEGORY: Record<string, string> = { paper: 'Paper', planning: 'Planning', diagram: 'Diagram', design: 'Design', workshop: 'Workshop' };

export function TemplatesPage() {
  const { data, isLoading } = useTemplatesQuery();
  const actions = useBoardActions();
  return (
    <>
      <TopBar left={<h1 className="text-lg font-semibold">Templates</h1>} />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <p className="mb-5 text-sm text-muted">Pick a starting point — each template creates a new board you can change freely.</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
          {isLoading && Array.from({ length: 10 }, (_, i) => <div key={i} className="h-56 animate-pulse rounded-xl bg-surface-2" />)}
          {data?.map((t) => (
            <button key={t.id} type="button" onClick={() => actions.create(t.id)} disabled={actions.creating} className="card group overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-pop">
              <span className="block aspect-[16/10] overflow-hidden border-b border-line bg-white">
                <TemplatePreview background={t.background} elements={t.content.elements} />
              </span>
              <span className="flex items-center justify-between p-3">
                <span className="text-sm font-semibold">{t.name}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{CATEGORY[t.category] ?? t.category}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
