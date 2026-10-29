import Konva from 'konva';
import type { Background, CanvasElement } from '@canvas/shared';
import { store } from '@/app/store';
import { downloadBlob, safeFileName } from '@/lib/download';
import { exportingSet } from '../slices/viewSlice';
import { contentBounds, type Rect } from './geometry';
import { drawBackground } from './background';
import { loadImage } from './imageCache';
import { CONTENT_LAYER_NAME, stageRegistry } from './stageRegistry';
import { boardToSvg } from './svg';

export type ExportFormat = 'png' | 'svg' | 'pdf';

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

function exportBounds(elements: CanvasElement[], all: CanvasElement[], pad = 32): Rect {
  // Connector bounds need the full element map, so compute against everything then filter.
  const ids = new Set(elements.map((e) => e.id));
  const b = contentBounds(all.filter((e) => ids.has(e.id) || (e.type === 'connector' && ids.has(e.data.from ?? '') && ids.has(e.data.to ?? ''))));
  return b ? { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 } : { x: 0, y: 0, width: 1200, height: 800 };
}

/** Renders background + elements (or a subset) to a canvas, independent of the current viewport. */
export async function renderBoardToCanvas(opts: { background: Background; elements: CanvasElement[]; onlyIds?: string[]; maxSize?: number }) {
  const stage = stageRegistry.stage;
  if (!stage) throw new Error('Canvas is not ready');
  const subset = opts.onlyIds?.length ? opts.elements.filter((e) => opts.onlyIds!.includes(e.id)) : opts.elements;
  const b = exportBounds(subset, opts.elements);

  store.dispatch(exportingSet(true));
  try {
    await frame();
    await Promise.allSettled(
      [...opts.elements.filter((e) => e.type === 'image' && e.data.src).map((e) => loadImage(e.data.src!)), ...(opts.background.type === 'image' && opts.background.imageUrl ? [loadImage(opts.background.imageUrl)] : [])],
    );
    await frame();
    await frame();

    const maxPixels = 8000;
    const pr = Math.min(opts.maxSize ? opts.maxSize / Math.max(b.width, b.height) : 2, maxPixels / Math.max(b.width, b.height));
    const W = Math.max(1, Math.round(b.width * pr)), H = Math.max(1, Math.round(b.height * pr));
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = canvas.getContext('2d')!;
    const bgImage = opts.background.type === 'image' && opts.background.imageUrl ? await loadImage(opts.background.imageUrl).catch(() => null) : null;
    drawBackground(ctx, opts.background, { x: -b.x * pr, y: -b.y * pr, scale: pr }, W, H, bgImage);

    const content = stage.findOne(`.${CONTENT_LAYER_NAME}`) as Konva.Layer | undefined;
    if (content) {
      const container = document.createElement('div');
      const tmp = new Konva.Stage({ container, width: b.width, height: b.height });
      const clone = content.clone({ x: -b.x, y: -b.y, scaleX: 1, scaleY: 1 }) as Konva.Layer;
      if (opts.onlyIds?.length) {
        const keep = new Set(subset.map((e) => e.id));
        for (const e of opts.elements) if (e.type === 'connector' && keep.has(e.data.from ?? '') && keep.has(e.data.to ?? '')) keep.add(e.id);
        clone.getChildren().forEach((c) => !keep.has(c.id()) && c.destroy());
      }
      tmp.add(clone);
      ctx.drawImage(tmp.toCanvas({ pixelRatio: pr }), 0, 0, W, H);
      tmp.destroy();
    }
    return canvas;
  } finally {
    store.dispatch(exportingSet(false));
  }
}

export async function exportBoard(format: ExportFormat, title: string, onlyIds?: string[]) {
  const { elements, background } = store.getState().editor.document;
  const name = safeFileName(title);
  if (format === 'svg') {
    const subset = onlyIds?.length ? elements.filter((e) => onlyIds.includes(e.id) || e.type === 'connector') : elements;
    const svg = boardToSvg(background, subset, { bounds: exportBounds(subset, elements), embedFonts: true });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`);
    return;
  }
  const canvas = await renderBoardToCanvas({ background, elements, onlyIds });
  if (format === 'png') {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('Could not create PNG');
    downloadBlob(blob, `${name}.png`);
  } else {
    const { jsPDF } = await import('jspdf');
    const w = canvas.width / 2, h = canvas.height / 2;
    const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h], hotfixes: ['px_scaling'] });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
    pdf.save(`${name}.pdf`);
  }
}

export async function renderThumbnail(): Promise<string | null> {
  const { elements, background } = store.getState().editor.document;
  try {
    const canvas = await renderBoardToCanvas({ background, elements, maxSize: 480 });
    return canvas.toDataURL('image/png');
  } catch {
    return null; // e.g. tainted canvas from a cross-origin image without CORS
  }
}
