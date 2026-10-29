import type { Background, CanvasElement, ElementStyle, ShapeKind } from './schemas';
import { DEFAULT_BACKGROUND } from './schemas';
import { FONT_HANDWRITTEN, FONT_SANS } from './constants';

export interface TemplateDefinition {
  id: string;
  name: string;
  category: 'paper' | 'planning' | 'diagram' | 'design' | 'workshop';
  background: Background;
  elements: CanvasElement[];
}

// Small builders so template content stays readable. Ids only need to be unique per board.
let z = 0;
const base = (id: string, type: CanvasElement['type'], x: number, y: number, width: number, height: number) => ({
  id,
  type,
  x,
  y,
  width,
  height,
  rotation: 0,
  zIndex: ++z,
  locked: false,
  groupId: null,
});

export function shapeEl(
  id: string,
  shape: ShapeKind,
  x: number,
  y: number,
  w: number,
  h: number,
  style: ElementStyle = {},
): CanvasElement {
  const style_ = { stroke: '#111827', strokeWidth: 2, fill: 'transparent', roughness: 1.2, seed: hashSeed(id), ...style };
  if (shape === 'line' || shape === 'arrow') {
    // Keep the local box at (0,0)-(|w|,|h|) so selection handles line up; direction lives in the points.
    const mx = Math.min(0, w), my = Math.min(0, h);
    return {
      ...base(id, 'shape', x + mx, y + my, Math.abs(w), Math.abs(h)),
      style: style_,
      data: { shape, points: [[-mx, -my], [w - mx, h - my]] },
    };
  }
  return { ...base(id, 'shape', x, y, w, h), style: style_, data: { shape } };
}

export function textEl(
  id: string,
  text: string,
  x: number,
  y: number,
  w: number,
  style: ElementStyle = {},
): CanvasElement {
  const fontSize = style.fontSize ?? 24;
  const lines = text.split('\n').length;
  return {
    ...base(id, 'text', x, y, w, Math.ceil(lines * fontSize * 1.25)),
    style: { stroke: '#111827', fontFamily: FONT_HANDWRITTEN, fontSize, ...style },
    data: { text },
  };
}

export function stickyEl(id: string, text: string, x: number, y: number, color: string, rotation = 0): CanvasElement {
  return {
    ...base(id, 'sticky', x, y, 180, 160),
    rotation,
    style: { fill: color, stroke: '#1F2937', fontFamily: FONT_HANDWRITTEN, fontSize: 24 },
    data: { text },
  };
}

export function connectorEl(id: string, from: string, to: string, style: ElementStyle = {}): CanvasElement {
  return {
    ...base(id, 'connector', 0, 0, 0, 0),
    style: { stroke: '#111827', strokeWidth: 2, roughness: 1, seed: hashSeed(id), ...style },
    data: { from, to },
  };
}

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h) % 2 ** 31;
}

const bg = (patch: Omit<Partial<Background>, 'grid'> & { grid?: Partial<Background['grid']> }): Background => ({
  ...DEFAULT_BACKGROUND,
  ...patch,
  grid: { ...DEFAULT_BACKGROUND.grid, ...patch.grid },
});

// ---------- Templates ----------

function planner(): CanvasElement[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const els: CanvasElement[] = [
    textEl('pl-title', 'Weekly Planner', 40, 20, 420, { fontSize: 56 }),
    textEl('pl-sub', 'Week of ____________', 44, 96, 360, { fontSize: 26, stroke: '#6B7280' }),
  ];
  days.forEach((d, i) => {
    const x = 40 + i * 190;
    els.push(shapeEl(`pl-col-${i}`, 'rectangle', x, 150, 170, 420, { fill: i >= 5 ? '#F5F3FF' : '#FFFFFF', stroke: '#9CA3AF', roughness: 0.6 }));
    els.push(textEl(`pl-day-${i}`, d, x + 14, 160, 140, { fontSize: 32, stroke: '#4F46E5' }));
  });
  els.push(stickyEl('pl-prio', 'Top 3 priorities\n1.\n2.\n3.', 40, 600, '#FEF08A', -2));
  els.push(stickyEl('pl-notes', 'Notes', 240, 600, '#BFDBFE', 1.5));
  return els;
}

function mindMap(): CanvasElement[] {
  const cx = 480;
  const cy = 320;
  const nodes: Array<[string, string, number, number, string]> = [
    ['mm-a', 'Idea A', cx - 360, cy - 200, '#FCE7F3'],
    ['mm-b', 'Idea B', cx + 260, cy - 200, '#DCFCE7'],
    ['mm-c', 'Idea C', cx - 360, cy + 160, '#DBEAFE'],
    ['mm-d', 'Idea D', cx + 260, cy + 160, '#EDE9FE'],
  ];
  const els: CanvasElement[] = [
    shapeEl('mm-root', 'ellipse', cx - 130, cy - 60, 260, 120, { fill: '#C7D2FE', stroke: '#1E3A8A', strokeWidth: 3 }),
    textEl('mm-root-t', 'Main idea', cx - 90, cy - 22, 200, { fontSize: 40, stroke: '#1E3A8A' }),
  ];
  nodes.forEach(([id, label, x, y, fill]) => {
    els.push(shapeEl(id, 'ellipse', x, y, 200, 90, { fill, strokeWidth: 2.5 }));
    els.push(textEl(`${id}-t`, label, x + 50, y + 26, 120, { fontSize: 32 }));
    els.push(connectorEl(`${id}-c`, 'mm-root', id));
  });
  return els;
}

function flowchart(): CanvasElement[] {
  const fill = { start: '#DCFCE7', step: '#DBEAFE', decision: '#FEF9C3', end: '#FCE7F3' };
  return [
    shapeEl('fc-start', 'ellipse', 380, 20, 200, 80, { fill: fill.start }),
    textEl('fc-start-t', 'Start', 448, 44, 100, { fontSize: 30 }),
    shapeEl('fc-step1', 'rectangle', 370, 150, 220, 90, { fill: fill.step }),
    textEl('fc-step1-t', 'Do something', 400, 178, 180, { fontSize: 28 }),
    shapeEl('fc-dec', 'diamond', 360, 290, 240, 150, { fill: fill.decision }),
    textEl('fc-dec-t', 'Is it OK?', 430, 348, 120, { fontSize: 28 }),
    shapeEl('fc-yes', 'rectangle', 680, 320, 200, 90, { fill: fill.step }),
    textEl('fc-yes-t', 'Ship it', 730, 348, 140, { fontSize: 28 }),
    shapeEl('fc-no', 'rectangle', 80, 320, 200, 90, { fill: fill.step }),
    textEl('fc-no-t', 'Fix it', 140, 348, 120, { fontSize: 28 }),
    shapeEl('fc-end', 'ellipse', 680, 500, 200, 80, { fill: fill.end }),
    textEl('fc-end-t', 'End', 758, 524, 80, { fontSize: 30 }),
    textEl('fc-yes-l', 'yes', 610, 330, 60, { fontSize: 22, stroke: '#16A34A' }),
    textEl('fc-no-l', 'no', 300, 330, 60, { fontSize: 22, stroke: '#DC2626' }),
    connectorEl('fc-c1', 'fc-start', 'fc-step1'),
    connectorEl('fc-c2', 'fc-step1', 'fc-dec'),
    connectorEl('fc-c3', 'fc-dec', 'fc-yes'),
    connectorEl('fc-c4', 'fc-dec', 'fc-no'),
    connectorEl('fc-c5', 'fc-yes', 'fc-end'),
    connectorEl('fc-c6', 'fc-no', 'fc-step1'),
  ];
}

function wireframe(): CanvasElement[] {
  const clean = { roughness: 0.8, stroke: '#64748B', strokeWidth: 2 };
  return [
    shapeEl('wf-frame', 'rectangle', 40, 40, 960, 640, { ...clean, fill: '#FFFFFF' }),
    shapeEl('wf-nav', 'rectangle', 40, 40, 960, 64, { ...clean, fill: '#E2E8F0' }),
    textEl('wf-logo', 'Logo', 64, 56, 100, { fontSize: 30, stroke: '#334155' }),
    textEl('wf-links', 'Home   Product   Pricing   Login', 640, 60, 340, { fontSize: 24, stroke: '#475569' }),
    shapeEl('wf-side', 'rectangle', 64, 128, 200, 528, { ...clean, fill: '#F1F5F9' }),
    textEl('wf-side-t', '• Menu item\n• Menu item\n• Menu item\n• Menu item', 84, 150, 170, { fontSize: 24, stroke: '#475569' }),
    shapeEl('wf-hero', 'rectangle', 288, 128, 688, 220, { ...clean, fill: '#EEF2FF' }),
    shapeEl('wf-hero-x1', 'line', 288, 128, 688, 220, { ...clean, stroke: '#A5B4FC' }),
    shapeEl('wf-hero-x2', 'line', 288, 348, 688, -220, { ...clean, stroke: '#A5B4FC' }),
    textEl('wf-hero-t', 'Hero image', 560, 222, 160, { fontSize: 30, stroke: '#4F46E5' }),
    shapeEl('wf-card1', 'rectangle', 288, 372, 216, 200, { ...clean, fill: '#F8FAFC' }),
    shapeEl('wf-card2', 'rectangle', 524, 372, 216, 200, { ...clean, fill: '#F8FAFC' }),
    shapeEl('wf-card3', 'rectangle', 760, 372, 216, 200, { ...clean, fill: '#F8FAFC' }),
    textEl('wf-card1-t', 'Card title\nShort description', 304, 390, 190, { fontSize: 22, stroke: '#475569' }),
    textEl('wf-card2-t', 'Card title\nShort description', 540, 390, 190, { fontSize: 22, stroke: '#475569' }),
    textEl('wf-card3-t', 'Card title\nShort description', 776, 390, 190, { fontSize: 22, stroke: '#475569' }),
    shapeEl('wf-btn', 'rectangle', 288, 596, 160, 48, { ...clean, fill: '#4F46E5', stroke: '#4338CA' }),
    textEl('wf-btn-t', 'Call to action', 302, 606, 140, { fontSize: 22, stroke: '#FFFFFF' }),
  ];
}

function brainstorm(): CanvasElement[] {
  const cols: Array<[string, string, number]> = [
    ['Ideas', '#FEF08A', 40],
    ['Questions', '#FBCFE8', 460],
    ['Next steps', '#BBF7D0', 880],
  ];
  const els: CanvasElement[] = [
    textEl('bs-title', 'Brainstorm: ____________', 40, 10, 700, { fontSize: 52 }),
  ];
  cols.forEach(([label, color, x], ci) => {
    els.push(shapeEl(`bs-col-${ci}`, 'rectangle', x, 90, 400, 560, { fill: 'transparent', stroke: '#CBD5E1', roughness: 0.8 }));
    els.push(textEl(`bs-col-${ci}-t`, label, x + 20, 104, 300, { fontSize: 36, stroke: '#334155' }));
    for (let i = 0; i < 4; i++) {
      els.push(
        stickyEl(`bs-${ci}-${i}`, i === 0 ? 'Add your note…' : '', x + 20 + (i % 2) * 190, 170 + Math.floor(i / 2) * 200, color, (i % 2 ? 2 : -2) + ci * 0.5),
      );
    }
  });
  return els;
}

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'tpl_blank', name: 'Blank Board', category: 'paper', background: bg({}), elements: [] },
  { id: 'tpl_grid', name: 'Grid Paper', category: 'paper', background: bg({ type: 'grid', grid: { spacing: 24, opacity: 0.6 } }), elements: [] },
  { id: 'tpl_dots', name: 'Dot Paper', category: 'paper', background: bg({ type: 'dots', grid: { spacing: 24, lineColor: '#9CA3AF', lineWidth: 2, opacity: 0.6 } }), elements: [] },
  { id: 'tpl_lined', name: 'Lined Paper', category: 'paper', background: bg({ type: 'lined', color: '#FFFDF7', grid: { spacing: 32, lineColor: '#93C5FD', opacity: 0.7 } }), elements: [] },
  { id: 'tpl_isometric', name: 'Isometric Grid', category: 'paper', background: bg({ type: 'isometric', grid: { spacing: 32, lineColor: '#CBD5E1', opacity: 0.7 } }), elements: [] },
  { id: 'tpl_planner', name: 'Planner', category: 'planning', background: bg({ type: 'dots', color: '#FAFAF9', grid: { spacing: 20, lineColor: '#D6D3D1', lineWidth: 2, opacity: 0.7 } }), elements: planner() },
  { id: 'tpl_mindmap', name: 'Mind Map', category: 'diagram', background: bg({}), elements: mindMap() },
  { id: 'tpl_flowchart', name: 'Flowchart', category: 'diagram', background: bg({ type: 'grid', grid: { spacing: 20, opacity: 0.4 } }), elements: flowchart() },
  { id: 'tpl_wireframe', name: 'Wireframe', category: 'design', background: bg({ type: 'graph', color: '#F8FAFC', grid: { spacing: 16, lineColor: '#CBD5E1', opacity: 0.5 } }), elements: wireframe() },
  { id: 'tpl_brainstorm', name: 'Brainstorm', category: 'workshop', background: bg({ type: 'dots', grid: { spacing: 28, lineColor: '#CBD5E1', lineWidth: 2, opacity: 0.8 } }), elements: brainstorm() },
];

/** Board created for every new account so the dashboard is never empty on first visit. */
export function welcomeBoard(): { title: string; background: Background; elements: CanvasElement[] } {
  const hl = { roughness: 1.6, strokeWidth: 3 };
  const elements: CanvasElement[] = [
    shapeEl('w-hl', 'rectangle', 20, 30, 330, 90, { fill: '#FDE047', stroke: '#FDE047', roughness: 2.2, opacity: 0.85 }),
    textEl('w-title', 'Design Ideas', 40, 28, 320, { fontSize: 72 }),
    shapeEl('w-core', 'ellipse', 270, 212, 310, 116, { fill: '#C7D2FE', stroke: '#1E40AF', ...hl }),
    textEl('w-core-t', 'Canvas Studio', 310, 243, 240, { fontSize: 44 }),
    shapeEl('w-plan', 'ellipse', 460, 70, 110, 70, { fill: '#FBCFE8', stroke: '#BE123C', ...hl }),
    textEl('w-plan-t', 'Plan', 488, 84, 80, { fontSize: 34 }),
    textEl('w-plan-l', '• Define goals\n• Explore options\n• Create workflow', 590, 70, 200, { fontSize: 22, fontFamily: FONT_HANDWRITTEN }),
    shapeEl('w-create', 'ellipse', 620, 270, 110, 70, { fill: '#DCFCE7', stroke: '#15803D', ...hl }),
    textEl('w-create-t', 'Create', 640, 284, 90, { fontSize: 34 }),
    textEl('w-create-l', '• Draw\n• Add elements\n• Collaborate', 640, 350, 180, { fontSize: 22 }),
    shapeEl('w-org', 'ellipse', 120, 310, 140, 70, { fill: '#DBEAFE', stroke: '#1D4ED8', ...hl }),
    textEl('w-org-t', 'Organize', 140, 324, 120, { fontSize: 34 }),
    textEl('w-org-l', '• Boards\n• Templates\n• Search & Sort', 160, 390, 180, { fontSize: 22 }),
    shapeEl('w-share', 'ellipse', 400, 410, 120, 70, { fill: '#E9D5FF', stroke: '#7E22CE', ...hl }),
    textEl('w-share-t', 'Share', 425, 424, 90, { fontSize: 34 }),
    textEl('w-share-l', '• Export\n• Present\n• Get feedback', 420, 490, 180, { fontSize: 22 }),
    connectorEl('w-c1', 'w-core', 'w-plan'),
    connectorEl('w-c2', 'w-core', 'w-create'),
    connectorEl('w-c3', 'w-core', 'w-org'),
    connectorEl('w-c4', 'w-core', 'w-share'),
    stickyEl('w-sticky', 'A flexible\nspace for\nyour ideas! ♡', 820, 60, '#D9F99D', 6),
    shapeEl('w-star', 'star', 870, 260, 60, 60, { stroke: '#DB2777', fill: '#F9A8D4', roughness: 1.5, strokeWidth: 3 }),
    shapeEl('w-loop', 'ellipse', 760, 400, 190, 150, { stroke: '#2563EB', strokeWidth: 3, roughness: 2 }),
    textEl('w-loop-t', 'Think\nCreate\nShare', 812, 412, 110, { fontSize: 34, stroke: '#1D4ED8' }),
    textEl('w-hint', 'Tip: press ? for keyboard shortcuts', 40, 580, 380, { fontSize: 18, fontFamily: FONT_SANS, stroke: '#6B7280' }),
  ];
  return {
    title: 'Design Ideas',
    background: bg({ type: 'grid', grid: { spacing: 24, lineColor: '#E5E7EB', opacity: 0.4 } }),
    elements,
  };
}
