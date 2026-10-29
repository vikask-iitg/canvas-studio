import type { Background } from '@canvas/shared';
import type { Rect } from './geometry';

export interface PatternGeometry {
  /** Line segments [x1, y1, x2, y2] in world units. */
  lines: number[][];
  /** Emphasised lines (graph paper majors). */
  majors: number[][];
  /** Dot centres [x, y]. */
  dots: number[][];
  spacing: number;
}

const SQRT3 = Math.sqrt(3);

/**
 * World-space pattern geometry covering `area`. `minScreenSpacing` keeps line density sane
 * when zoomed out by doubling the spacing until it is at least that many screen pixels.
 */
export function patternGeometry(bg: Background, area: Rect, scale = 1, minScreenSpacing = 6): PatternGeometry {
  const out: PatternGeometry = { lines: [], majors: [], dots: [], spacing: bg.grid.spacing };
  if (!['grid', 'dots', 'lined', 'isometric', 'graph'].includes(bg.type)) return out;
  let s = bg.grid.spacing;
  while (s * scale < minScreenSpacing) s *= 2;
  out.spacing = s;
  const x0 = Math.floor(area.x / s) * s, x1 = area.x + area.width;
  const y0 = Math.floor(area.y / s) * s, y1 = area.y + area.height;
  const top = area.y, bottom = y1, left = area.x, right = x1;

  switch (bg.type) {
    case 'grid':
      for (let x = x0; x <= x1; x += s) out.lines.push([x, top, x, bottom]);
      for (let y = y0; y <= y1; y += s) out.lines.push([left, y, right, y]);
      break;
    case 'graph': {
      const major = s * 5;
      for (let x = x0; x <= x1; x += s) (Math.round(x / s) % 5 === 0 ? out.majors : out.lines).push([x, top, x, bottom]);
      for (let y = y0; y <= y1; y += s) (Math.round(y / s) % 5 === 0 ? out.majors : out.lines).push([left, y, right, y]);
      void major;
      break;
    }
    case 'lined':
      for (let y = y0; y <= y1; y += s) out.lines.push([left, y, right, y]);
      break;
    case 'dots':
      if ((x1 - x0) * (y1 - y0) / (s * s) > 60000) break;
      for (let x = x0; x <= x1; x += s) for (let y = y0; y <= y1; y += s) out.dots.push([x, y]);
      break;
    case 'isometric': {
      // Vertical lines every s·√3/2, plus ±30° families spaced s apart vertically.
      const dx = (s * SQRT3) / 2;
      for (let x = Math.floor(left / dx) * dx; x <= right; x += dx) out.lines.push([x, top, x, bottom]);
      const m = 1 / SQRT3;
      for (const slope of [m, -m]) {
        const cA = top - slope * left, cB = top - slope * right, cC = bottom - slope * left, cD = bottom - slope * right;
        const cMin = Math.min(cA, cB, cC, cD), cMax = Math.max(cA, cB, cC, cD);
        for (let c = Math.floor(cMin / s) * s; c <= cMax; c += s) out.lines.push([left, slope * left + c, right, slope * right + c]);
      }
      break;
    }
  }
  return out;
}

let textureTile: HTMLCanvasElement | null = null;

/** Deterministic paper-grain tile used for the Texture background. */
export function getTextureTile() {
  if (textureTile) return textureTile;
  const c = Object.assign(document.createElement('canvas'), { width: 160, height: 160 });
  const ctx = c.getContext('2d')!;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const a = rand() * 0.07;
    ctx.fillStyle = rand() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 1.5})`;
    ctx.fillRect(rand() * 160, rand() * 160, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(120,100,70,${rand() * 0.05})`;
    ctx.beginPath();
    const x = rand() * 160, y = rand() * 160;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 30, y + (rand() - 0.5) * 30);
    ctx.stroke();
  }
  return (textureTile = c);
}

/**
 * Paints the board background into a native context. `vp` maps world → device pixels
 * (x, y offset and scale); `width`/`height` are the output size in the same pixels.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: Background,
  vp: { x: number; y: number; scale: number },
  width: number,
  height: number,
  image?: HTMLImageElement | null,
) {
  ctx.save();
  ctx.fillStyle = bg.color;
  ctx.fillRect(0, 0, width, height);

  if (bg.type === 'texture') {
    const pattern = ctx.createPattern(getTextureTile(), 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  } else if (bg.type === 'image' && image?.complete && image.naturalWidth) {
    if (bg.imageFit === 'tile') {
      const pattern = ctx.createPattern(image, 'repeat');
      if (pattern) {
        pattern.setTransform(new DOMMatrix([vp.scale, 0, 0, vp.scale, vp.x, vp.y]));
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      const s = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * s, h = image.naturalHeight * s;
      ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    }
  } else {
    const area = { x: -vp.x / vp.scale, y: -vp.y / vp.scale, width: width / vp.scale, height: height / vp.scale };
    const geo = patternGeometry(bg, area, vp.scale);
    ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([vp.scale, 0, 0, vp.scale, vp.x, vp.y])));
    ctx.globalAlpha = bg.grid.opacity;
    ctx.strokeStyle = bg.grid.lineColor;
    ctx.fillStyle = bg.grid.lineColor;
    const lw = bg.grid.lineWidth / vp.scale;
    const strokeLines = (lines: number[][], width: number) => {
      if (!lines.length) return;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (const [a, b, c, d] of lines) {
        ctx.moveTo(a, b);
        ctx.lineTo(c, d);
      }
      ctx.stroke();
    };
    strokeLines(geo.lines, lw);
    strokeLines(geo.majors, lw * 1.8);
    if (geo.dots.length) {
      // Dots need more ink than lines to read at the same settings.
      const r = dotRadius(bg) / vp.scale;
      ctx.globalAlpha = dotAlpha(bg);
      ctx.beginPath();
      for (const [x, y] of geo.dots) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  ctx.restore();
}

export const dotRadius = (bg: Background) => Math.max(1.2, bg.grid.lineWidth * 1.25);
export const dotAlpha = (bg: Background) => Math.min(1, bg.grid.opacity * 2);
