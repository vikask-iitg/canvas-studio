import { FONT_HANDWRITTEN, type CanvasElement, type ShapeKind } from '@canvas/shared';
import { newId, randomSeed } from '@/lib/ids';
import type { ToolsState } from '../slices/toolsSlice';
import { STICKY_SIZE } from './constants';

const base = (type: CanvasElement['type'], x: number, y: number, width: number, height: number): Omit<CanvasElement, 'style' | 'data'> => ({
  id: newId(type.slice(0, 2)),
  type,
  x,
  y,
  width,
  height,
  rotation: 0,
  zIndex: 0,
  locked: false,
  groupId: null,
});

/** Turns world-space pen points into an element whose points are relative to its top-left. */
export function createStroke(points: number[][], tools: ToolsState, highlighter: boolean): CanvasElement {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return {
    ...base('stroke', minX, minY, Math.max(1, Math.max(...xs) - minX), Math.max(1, Math.max(...ys) - minY)),
    style: { stroke: tools.color, strokeWidth: tools.strokeWidth, ...(highlighter ? { opacity: 0.35 } : {}) },
    data: { points: points.map(([x, y, p]) => [+(x - minX).toFixed(2), +(y - minY).toFixed(2), +(p ?? 0.5).toFixed(2)]) },
  };
}

export function createShape(kind: ShapeKind, x1: number, y1: number, x2: number, y2: number, tools: ToolsState): CanvasElement {
  const style = {
    stroke: tools.color,
    strokeWidth: Math.max(1, Math.min(tools.strokeWidth, 12)),
    fill: kind === 'line' || kind === 'arrow' ? 'transparent' : tools.fill,
    roughness: tools.handDrawn ? 1.2 : 0,
    seed: randomSeed(),
  };
  if (kind === 'line' || kind === 'arrow') {
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    return {
      ...base('shape', x, y, Math.abs(x2 - x1), Math.abs(y2 - y1)),
      style,
      data: { shape: kind, points: [[x1 - x, y1 - y], [x2 - x, y2 - y]] },
    };
  }
  return { ...base('shape', Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)), style, data: { shape: kind } };
}

export function createText(x: number, y: number, tools: ToolsState, text = ''): CanvasElement {
  return {
    ...base('text', x, y, 20, tools.fontSize * 1.2),
    style: { stroke: tools.color === '#FFFFFF' ? '#111827' : tools.color, fontFamily: tools.fontFamily, fontSize: tools.fontSize },
    data: { text },
  };
}

export function createSticky(cx: number, cy: number, tools: ToolsState): CanvasElement {
  return {
    ...base('sticky', cx - STICKY_SIZE / 2, cy - STICKY_SIZE / 2, STICKY_SIZE, STICKY_SIZE * 0.9),
    rotation: +(Math.random() * 4 - 2).toFixed(1),
    style: { fill: tools.stickyColor, stroke: '#1F2937', fontFamily: FONT_HANDWRITTEN, fontSize: 24 },
    data: { text: '' },
  };
}

export function createImage(src: string, cx: number, cy: number, width: number, height: number, maxSide = 520): CanvasElement {
  const s = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * s), h = Math.round(height * s);
  return { ...base('image', cx - w / 2, cy - h / 2, w, h), style: {}, data: { src } };
}

export function createConnector(from: string, to: string, tools: ToolsState): CanvasElement {
  return {
    ...base('connector', 0, 0, 0, 0),
    style: { stroke: tools.color, strokeWidth: Math.max(1, Math.min(tools.strokeWidth, 8)), roughness: tools.handDrawn ? 1 : 0, seed: randomSeed() },
    data: { from, to },
  };
}

/** Deep copy with fresh ids, remapping connector ends and group ids inside the copied set. */
export function cloneElements(els: CanvasElement[], dx: number, dy: number): CanvasElement[] {
  const idMap = new Map(els.map((e) => [e.id, newId(e.type.slice(0, 2))]));
  const groupMap = new Map<string, string>();
  return els
    .filter((e) => e.type !== 'connector' || (idMap.has(e.data.from ?? '') && idMap.has(e.data.to ?? '')))
    .map((e) => {
      const groupId = e.groupId ? (groupMap.get(e.groupId) ?? groupMap.set(e.groupId, newId('grp')).get(e.groupId)!) : null;
      return {
        ...structuredClone(e),
        id: idMap.get(e.id)!,
        groupId,
        x: e.type === 'connector' ? 0 : e.x + dx,
        y: e.type === 'connector' ? 0 : e.y + dy,
        data: e.type === 'connector' ? { ...e.data, from: idMap.get(e.data.from!)!, to: idMap.get(e.data.to!)! } : structuredClone(e.data),
        locked: false,
      };
    });
}
