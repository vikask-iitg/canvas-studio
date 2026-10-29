import type { Background, CanvasElement } from '@canvas/shared';
import { connectorEndpoints, contentBounds, type Rect } from './geometry';
import { dotAlpha, dotRadius, patternGeometry } from './background';
import { connectorPaths, shapePaths } from './rough';
import { strokeGeometry } from './stroke';
import { TEXT_LINE_HEIGHT, STICKY_PADDING } from './constants';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => +v.toFixed(2);

const absoluteUrl = (src: string) => (src.startsWith('/') ? `${location.origin}${src}` : src);

function textSvg(text: string, x: number, y: number, size: number, family: string, fill: string, width?: number) {
  const lines = text.split('\n');
  const tspans = lines
    .map((l, i) => `<tspan x="${n(x)}" dy="${i === 0 ? n(size * 0.92) : n(size * TEXT_LINE_HEIGHT)}">${esc(l) || ' '}</tspan>`)
    .join('');
  void width;
  return `<text x="${n(x)}" y="${n(y)}" font-family="${esc(family)}, cursive, sans-serif" font-size="${n(size)}" fill="${esc(fill)}">${tspans}</text>`;
}

function elementSvg(el: CanvasElement, byId: Map<string, CanvasElement>): string {
  const t = `translate(${n(el.x)} ${n(el.y)})${el.rotation ? ` rotate(${n(el.rotation)})` : ''}`;
  const opacity = el.style.opacity !== undefined && el.style.opacity < 1 ? ` opacity="${el.style.opacity}"` : '';
  switch (el.type) {
    case 'stroke':
      return `<g transform="${t}"${opacity}><path d="${strokeGeometry(el).d}" fill="${esc(el.style.stroke ?? '#111827')}"/></g>`;
    case 'shape': {
      const paths = shapePaths(el)
        .map((p) => `<path d="${p.d}" fill="${esc(p.fill ?? 'none')}" stroke="${esc(p.stroke)}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`)
        .join('');
      return `<g transform="${t}"${opacity}>${paths}</g>`;
    }
    case 'text':
      return `<g transform="${t}"${opacity}>${textSvg(el.data.text ?? '', 0, 0, el.style.fontSize ?? 24, el.style.fontFamily ?? 'Caveat', el.style.stroke ?? '#111827')}</g>`;
    case 'image':
      return el.data.src
        ? `<g transform="${t}"${opacity}><image href="${esc(absoluteUrl(el.data.src))}" width="${n(el.width)}" height="${n(el.height)}" preserveAspectRatio="none"/></g>`
        : '';
    case 'sticky':
      return (
        `<g transform="${t}"${opacity}><rect width="${n(el.width)}" height="${n(el.height)}" rx="4" fill="${esc(el.style.fill ?? '#FEF08A')}" filter="url(#cs-shadow)"/>` +
        textSvg(el.data.text ?? '', STICKY_PADDING, STICKY_PADDING, el.style.fontSize ?? 24, el.style.fontFamily ?? 'Caveat', el.style.stroke ?? '#1F2937') +
        `</g>`
      );
    case 'connector': {
      const ends = connectorEndpoints(el, byId);
      if (!ends) return '';
      return connectorPaths(el, ...ends)
        .map((p) => `<path d="${p.d}" fill="none" stroke="${esc(p.stroke)}" stroke-width="${p.strokeWidth}" stroke-linecap="round"/>`)
        .join('');
    }
  }
}

function backgroundSvg(bg: Background, b: Rect) {
  let out = `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.width)}" height="${n(b.height)}" fill="${bg.color}"/>`;
  if (bg.type === 'texture') {
    out += `<filter id="cs-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0.08 0"/></filter><rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.width)}" height="${n(b.height)}" filter="url(#cs-grain)"/>`;
  } else if (bg.type === 'image' && bg.imageUrl) {
    out += `<image href="${esc(absoluteUrl(bg.imageUrl))}" x="${n(b.x)}" y="${n(b.y)}" width="${n(b.width)}" height="${n(b.height)}" preserveAspectRatio="xMidYMid slice"/>`;
  } else {
    const geo = patternGeometry(bg, b, 1, 0);
    const path = (ls: number[][]) => ls.map(([a, c, d, e]) => `M${n(a)} ${n(c)}L${n(d)} ${n(e)}`).join('');
    const common = `stroke="${bg.grid.lineColor}" stroke-opacity="${bg.grid.opacity}" fill="none"`;
    if (geo.lines.length) out += `<path d="${path(geo.lines)}" ${common} stroke-width="${bg.grid.lineWidth}"/>`;
    if (geo.majors.length) out += `<path d="${path(geo.majors)}" ${common} stroke-width="${bg.grid.lineWidth * 1.8}"/>`;
    if (geo.dots.length) {
      const r = dotRadius(bg);
      out += `<g fill="${bg.grid.lineColor}" fill-opacity="${dotAlpha(bg)}">${geo.dots.map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"/>`).join('')}</g>`;
    }
  }
  return `<clipPath id="cs-clip"><rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.width)}" height="${n(b.height)}"/></clipPath><g clip-path="url(#cs-clip)">${out}</g>`;
}

export interface SvgOptions {
  bounds?: Rect;
  padding?: number;
  /** Rendered width/height attributes; defaults to the bounds size. */
  width?: number;
  height?: number;
  embedFonts?: boolean;
}

export function boardToSvg(background: Background, elements: CanvasElement[], opts: SvgOptions = {}) {
  const pad = opts.padding ?? 32;
  const cb = contentBounds(elements);
  const b = opts.bounds ?? (cb ? { x: cb.x - pad, y: cb.y - pad, width: cb.width + pad * 2, height: cb.height + pad * 2 } : { x: 0, y: 0, width: 1200, height: 800 });
  const byId = new Map(elements.map((e) => [e.id, e]));
  const body = [...elements].sort((a, z) => a.zIndex - z.zIndex).map((e) => elementSvg(e, byId)).join('');
  const fonts = opts.embedFonts
    ? `<style>@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&amp;family=Inter:wght@400;600&amp;family=Patrick+Hand&amp;display=swap');</style>`
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(b.x)} ${n(b.y)} ${n(b.width)} ${n(b.height)}" width="${n(opts.width ?? b.width)}" height="${n(opts.height ?? b.height)}">` +
    `<defs>${fonts}<filter id="cs-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity="0.18"/></filter></defs>` +
    backgroundSvg(background, b) +
    body +
    `</svg>`
  );
}
