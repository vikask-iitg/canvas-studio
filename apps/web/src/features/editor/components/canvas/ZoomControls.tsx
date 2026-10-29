import { Maximize, Minus, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { IconButton } from '@/components/ui/IconButton';
import { zoomBy, zoomTo, zoomToFit } from '../../actions';

export function ZoomControls() {
  const dispatch = useAppDispatch();
  const scale = useAppSelector((s) => s.editor.view.viewport.scale);
  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-card">
      <IconButton size="sm" label="Zoom out (−)" onClick={() => dispatch(zoomBy(1 / 1.2))}>
        <Minus size={15} />
      </IconButton>
      <button
        type="button"
        className="h-7 min-w-[52px] rounded-md px-1 text-xs font-medium tabular-nums text-fg hover:bg-surface-2"
        title="Reset to 100%"
        onClick={() => dispatch(zoomTo(1))}
      >
        {Math.round(scale * 100)}%
      </button>
      <IconButton size="sm" label="Zoom in (+)" onClick={() => dispatch(zoomBy(1.2))}>
        <Plus size={15} />
      </IconButton>
      <IconButton size="sm" label="Zoom to fit (⇧1)" onClick={() => dispatch(zoomToFit())}>
        <Maximize size={14} />
      </IconButton>
    </div>
  );
}
