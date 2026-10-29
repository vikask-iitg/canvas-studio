import { describe, expect, it } from 'vitest';
import { TEMPLATES, backgroundSchema, boardContentSchema, updateBoardSchema, welcomeBoard } from './index';

describe('shared schemas', () => {
  it('every built-in template validates', () => {
    expect(TEMPLATES).toHaveLength(10);
    for (const t of TEMPLATES) {
      expect(backgroundSchema.safeParse(t.background).success).toBe(true);
      expect(boardContentSchema.safeParse({ elements: t.elements }).success).toBe(true);
    }
  });

  it('welcome board validates', () => {
    const w = welcomeBoard();
    expect(boardContentSchema.safeParse({ elements: w.elements }).success).toBe(true);
  });

  it('requires a version when content changes', () => {
    expect(updateBoardSchema.safeParse({ content: { elements: [] } }).success).toBe(false);
    expect(updateBoardSchema.safeParse({ content: { elements: [] }, version: 3 }).success).toBe(true);
    expect(updateBoardSchema.safeParse({ title: 'Hi' }).success).toBe(true);
  });

  it('rejects out-of-range grid settings', () => {
    const bad = { ...TEMPLATES[1].background, grid: { ...TEMPLATES[1].background.grid, spacing: 100 } };
    expect(backgroundSchema.safeParse(bad).success).toBe(false);
  });
});
