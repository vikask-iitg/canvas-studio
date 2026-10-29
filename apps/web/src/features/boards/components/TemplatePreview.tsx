import { memo, useMemo } from 'react';
import type { Background, CanvasElement } from '@canvas/shared';
import { boardToSvg } from '@/features/editor/canvas/svg';
import { contentBounds } from '@/features/editor/canvas/geometry';

/** Static SVG thumbnail of a template or board, rendered with the editor's own geometry. */
export const TemplatePreview = memo(function TemplatePreview({ background, elements, className }: { background: Background; elements: CanvasElement[]; className?: string }) {
  const src = useMemo(() => {
    const b = contentBounds(elements);
    const pad = 40;
    let bounds = b ? { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 } : { x: 0, y: 0, width: 480, height: 300 };
    // Normalise to 16:10 so cards line up.
    const target = 1.6;
    if (bounds.width / bounds.height > target) {
      const h = bounds.width / target;
      bounds = { ...bounds, y: bounds.y - (h - bounds.height) / 2, height: h };
    } else {
      const w = bounds.height * target;
      bounds = { ...bounds, x: bounds.x - (w - bounds.width) / 2, width: w };
    }
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(boardToSvg(background, elements, { bounds, width: 320, height: 200 }))}`;
  }, [background, elements]);
  return <img src={src} alt="" draggable={false} className={className ?? 'h-full w-full object-cover'} />;
});
