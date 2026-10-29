import { getStroke } from 'perfect-freehand';
import type { CanvasElement } from '@canvas/shared';

export const isHighlighter = (el: CanvasElement) => (el.style.opacity ?? 1) < 1;

/** Stroke diameter in perfect-freehand units for a given toolbar width (1–20). */
export const strokeSize = (width: number, highlighter: boolean) => (highlighter ? width * 4 + 6 : width * 1.4 + 1);

export function strokeOutline(points: number[][], width: number, highlighter: boolean) {
  const hasPressure = points.some((p) => p[2] !== undefined && p[2] !== 0.5);
  return getStroke(points, {
    size: strokeSize(width, highlighter),
    thinning: highlighter ? 0 : 0.6,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: !hasPressure && !highlighter,
    last: true,
    start: { cap: true },
    end: { cap: true },
  });
}

const cache = new WeakMap<number[][], { key: string; outline: number[][]; d: string }>();

export function outlineToSvgPath(outline: number[][]) {
  if (outline.length < 2) return '';
  const avg = (a: number, b: number) => ((a + b) / 2).toFixed(2);
  let d = `M${outline[0][0].toFixed(2)},${outline[0][1].toFixed(2)} Q`;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += `${x0.toFixed(2)},${y0.toFixed(2)} ${avg(x0, x1)},${avg(y0, y1)} `;
  }
  return d + 'Z';
}

/** Outline polygon + SVG path for a stroke element, memoised on its points array. */
export function strokeGeometry(el: CanvasElement) {
  const points = el.data.points ?? [];
  const width = el.style.strokeWidth ?? 4;
  const key = `${width}|${isHighlighter(el)}`;
  const hit = cache.get(points);
  if (hit && hit.key === key) return hit;
  const outline = strokeOutline(points, width, isHighlighter(el));
  const entry = { key, outline, d: outlineToSvgPath(outline) };
  cache.set(points, entry);
  return entry;
}
