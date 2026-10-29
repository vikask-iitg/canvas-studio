import { DEFAULT_BACKGROUND, type Background } from '@canvas/shared';

const bg = (p: Omit<Partial<Background>, 'grid'> & { grid?: Partial<Background['grid']> }): Background => ({
  ...DEFAULT_BACKGROUND,
  ...p,
  grid: { ...DEFAULT_BACKGROUND.grid, ...p.grid },
});

export const BACKGROUND_PRESETS: Array<{ name: string; background: Background }> = [
  { name: 'Blueprint', background: bg({ type: 'grid', color: '#1E3A8A', grid: { spacing: 24, lineColor: '#93C5FD', lineWidth: 1, opacity: 0.35 } }) },
  { name: 'Notebook', background: bg({ type: 'lined', color: '#FFFDF5', grid: { spacing: 32, lineColor: '#93C5FD', lineWidth: 1, opacity: 0.7 } }) },
  { name: 'Chalkboard', background: bg({ type: 'texture', color: '#22302A' }) },
  { name: 'Engineering', background: bg({ type: 'graph', color: '#F0FDF4', grid: { spacing: 12, lineColor: '#86EFAC', lineWidth: 1, opacity: 0.6 } }) },
  { name: 'Kraft paper', background: bg({ type: 'texture', color: '#D9BE94' }) },
  { name: 'Midnight dots', background: bg({ type: 'dots', color: '#0F172A', grid: { spacing: 24, lineColor: '#475569', lineWidth: 2, opacity: 0.9 } }) },
  { name: 'Isometric draft', background: bg({ type: 'isometric', color: '#FAFAF9', grid: { spacing: 28, lineColor: '#A8A29E', lineWidth: 1, opacity: 0.45 } }) },
  { name: 'Soft grid', background: bg({ type: 'grid', color: '#FFFFFF', grid: { spacing: 24, lineColor: '#E5E7EB', lineWidth: 1, opacity: 0.4 } }) },
];

export const PAPER_COLORS = [
  '#FFFFFF', '#F8FAFC', '#FFFDF5', '#FEF9C3', '#FCE7F3',
  '#EEF2FF', '#ECFDF5', '#F0F9FF', '#F5F5F4', '#E7E5E4',
  '#1E3A8A', '#0F172A', '#22302A', '#111827', '#3F3F46',
];
