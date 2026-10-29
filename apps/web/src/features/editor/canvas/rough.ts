import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import type { CanvasElement, ShapeKind } from '@canvas/shared';

const gen = rough.generator();

export interface PathOp {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  path2d?: Path2D;
}

function starPoints(w: number, h: number, spikes = 5): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.21;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push([w / 2 + Math.cos(a) * w * r, h / 2 + Math.sin(a) * h * r * 1.05 + h * 0.03]);
  }
  return pts;
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, width: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.min(Math.max(12, width * 4), Math.hypot(x2 - x1, y2 - y1) * 0.5);
  const spread = Math.PI / 7;
  return [
    [x2, y2, x2 - len * Math.cos(angle - spread), y2 - len * Math.sin(angle - spread)],
    [x2, y2, x2 - len * Math.cos(angle + spread), y2 - len * Math.sin(angle + spread)],
  ] as const;
}

function roughOptions(style: CanvasElement['style']): Options {
  const roughness = style.roughness ?? 1;
  const fill = style.fill && style.fill !== 'transparent' ? style.fill : undefined;
  return {
    seed: style.seed || 1,
    roughness,
    bowing: roughness ? 1 : 0,
    stroke: style.stroke ?? '#111827',
    strokeWidth: style.strokeWidth ?? 2,
    fill,
    fillStyle: 'solid',
    disableMultiStroke: roughness === 0,
    preserveVertices: roughness === 0,
    curveStepCount: roughness === 0 ? 24 : 9,
  };
}

function drawables(kind: ShapeKind, w: number, h: number, o: Options, points?: number[][]) {
  switch (kind) {
    case 'rectangle':
      return [gen.rectangle(0, 0, w, h, o)];
    case 'ellipse':
      return [gen.ellipse(w / 2, h / 2, w, h, o)];
    case 'triangle':
      return [gen.polygon([[w / 2, 0], [w, h], [0, h]], o)];
    case 'diamond':
      return [gen.polygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]], o)];
    case 'star':
      return [gen.polygon(starPoints(w, h), o)];
    case 'line':
    case 'arrow': {
      const [[x1, y1], [x2, y2]] = points && points.length >= 2 ? [points[0], points[points.length - 1]] : [[0, 0], [w, h]];
      const out = [gen.line(x1, y1, x2, y2, o)];
      if (kind === 'arrow') for (const [a, b, c, d] of arrowHead(x1, y1, x2, y2, o.strokeWidth ?? 2)) out.push(gen.line(a, b, c, d, o));
      return out;
    }
  }
}

const cache = new Map<string, { key: string; ops: PathOp[] }>();

function toOps(ds: ReturnType<typeof drawables>): PathOp[] {
  return ds.flatMap((d) => gen.toPaths(d)).map((p) => ({ d: p.d, stroke: p.stroke, strokeWidth: p.strokeWidth, fill: p.fill }));
}

/** Path ops (SVG `d` + paint) for a shape element, cached per element id until its geometry/style changes. */
export function shapePaths(el: CanvasElement): PathOp[] {
  const kind = el.data.shape ?? 'rectangle';
  const key = `${kind}|${el.width.toFixed(1)}|${el.height.toFixed(1)}|${JSON.stringify(el.style)}|${JSON.stringify(el.data.points ?? '')}`;
  const hit = cache.get(el.id);
  if (hit && hit.key === key) return hit.ops;
  const ops = toOps(drawables(kind, el.width, el.height, roughOptions(el.style), el.data.points));
  if (cache.size > 5000) cache.clear();
  cache.set(el.id, { key, ops });
  return ops;
}

/** Arrow from (x1,y1) to (x2,y2) for connectors. Not cached by id — endpoints change as shapes move. */
export function connectorPaths(el: CanvasElement, x1: number, y1: number, x2: number, y2: number): PathOp[] {
  const o = roughOptions({ ...el.style, fill: undefined });
  const ds = [gen.line(x1, y1, x2, y2, o), ...arrowHead(x1, y1, x2, y2, o.strokeWidth ?? 2).map(([a, b, c, d]) => gen.line(a, b, c, d, o))];
  return toOps(ds);
}

/** Paints path ops onto a native 2D context (already transformed by Konva). */
export function paintOps(ctx: CanvasRenderingContext2D, ops: PathOp[]) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const op of ops) {
    op.path2d ??= new Path2D(op.d);
    if (op.fill && op.fill !== 'none') {
      ctx.fillStyle = op.fill;
      ctx.fill(op.path2d);
    }
    if (op.stroke && op.stroke !== 'none') {
      ctx.strokeStyle = op.stroke;
      ctx.lineWidth = op.strokeWidth;
      ctx.stroke(op.path2d);
    }
  }
}
