import type { CanvasElement } from '@canvas/shared';
import { clampZoom, type Viewport } from '../slices/viewSlice';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}

export const isLineShape = (el: CanvasElement) => el.type === 'shape' && (el.data.shape === 'line' || el.data.shape === 'arrow');

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

export function rectsIntersect(a: Rect, b: Rect) {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.width);
    y2 = Math.max(y2, r.y + r.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export const center = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** Axis-aligned box of an element's local (0,0)-(w,h) box after rotation about its origin. */
export function elementBounds(el: CanvasElement, byId?: Map<string, CanvasElement>): Rect {
  if (el.type === 'connector') {
    const ends = byId && connectorEndpoints(el, byId);
    if (!ends) return { x: 0, y: 0, width: 0, height: 0 };
    return normalizeRect(ends[0], ends[1], ends[2], ends[3]);
  }
  const x0 = Math.min(0, el.width), x1 = Math.max(0, el.width);
  const y0 = Math.min(0, el.height), y1 = Math.max(0, el.height);
  const pad = el.type === 'stroke' || isLineShape(el) ? (el.style.strokeWidth ?? 2) : 0;
  if (!el.rotation) return { x: el.x + x0 - pad, y: el.y + y0 - pad, width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 };
  const r = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([px, py]) => ({ x: el.x + px * cos - py * sin, y: el.y + px * sin + py * cos }));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(...xs) - Math.min(...xs) + pad * 2, height: Math.max(...ys) - Math.min(...ys) + pad * 2 };
}

/** Where a ray from the box centre toward `toward` leaves the box. */
function boxEdgePoint(r: Rect, toward: Point, gap: number): Point {
  const c = center(r);
  const dx = toward.x - c.x, dy = toward.y - c.y;
  if (!dx && !dy) return c;
  const tx = dx ? r.width / 2 / Math.abs(dx) : Infinity;
  const ty = dy ? r.height / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty, 1);
  const len = Math.hypot(dx, dy);
  return { x: c.x + dx * t + (dx / len) * gap, y: c.y + dy * t + (dy / len) * gap };
}

/** [x1, y1, x2, y2] for a connector, or null when either end no longer exists. */
export function connectorEndpoints(el: CanvasElement, byId: Map<string, CanvasElement>): [number, number, number, number] | null {
  const a = byId.get(el.data.from ?? ''), b = byId.get(el.data.to ?? '');
  if (!a || !b) return null;
  const ra = elementBounds(a), rb = elementBounds(b);
  const p1 = boxEdgePoint(ra, center(rb), 6);
  const p2 = boxEdgePoint(rb, center(ra), 6);
  return [p1.x, p1.y, p2.x, p2.y];
}

export const snapTo = (v: number, step: number) => Math.round(v / step) * step;

export function zoomAround(vp: Viewport, nextScale: number, screen: Point): Viewport {
  const scale = clampZoom(nextScale);
  const wx = (screen.x - vp.x) / vp.scale, wy = (screen.y - vp.y) / vp.scale;
  return { scale, x: screen.x - wx * scale, y: screen.y - wy * scale };
}

export function fitRect(r: Rect, width: number, height: number, padding = 80, maxScale = 1): Viewport {
  const scale = clampZoom(Math.min(maxScale, (width - padding * 2) / Math.max(r.width, 1), (height - padding * 2) / Math.max(r.height, 1)));
  return { scale, x: width / 2 - (r.x + r.width / 2) * scale, y: height / 2 - (r.y + r.height / 2) * scale };
}

export function visibleWorldRect(vp: Viewport, width: number, height: number): Rect {
  return { x: -vp.x / vp.scale, y: -vp.y / vp.scale, width: width / vp.scale, height: height / vp.scale };
}

export function contentBounds(elements: CanvasElement[]): Rect | null {
  const byId = new Map(elements.map((e) => [e.id, e]));
  return unionRects(elements.map((e) => elementBounds(e, byId)).filter((r) => r.width || r.height));
}
