import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKGROUND, MAX_UNDO_STEPS, shapeEl } from '@canvas/shared';
import reducer, { boardLoaded, elementsAdded, elementsRemoved, elementsReordered, elementsUpdated, redo, undo } from './documentSlice';

const load = () =>
  reducer(undefined, boardLoaded({ boardId: 'b1', elements: [], background: DEFAULT_BACKGROUND, version: 1, updatedAt: new Date().toISOString() }));

describe('documentSlice', () => {
  it('adds, updates and undoes/redoes as discrete steps', () => {
    let s = load();
    s = reducer(s, elementsAdded([shapeEl('a', 'rectangle', 0, 0, 10, 10)]));
    s = reducer(s, elementsUpdated([{ id: 'a', x: 50 }]));
    expect(s.elements[0].x).toBe(50);
    s = reducer(s, undo());
    expect(s.elements[0].x).toBe(0);
    s = reducer(s, undo());
    expect(s.elements).toHaveLength(0);
    s = reducer(s, redo());
    s = reducer(s, redo());
    expect(s.elements[0].x).toBe(50);
    expect(s.changeSeq).toBe(6);
  });

  it('caps history at the configured undo depth', () => {
    let s = load();
    for (let i = 0; i < MAX_UNDO_STEPS + 10; i++) s = reducer(s, elementsAdded([shapeEl(`e${i}`, 'ellipse', i, 0, 5, 5)]));
    expect(s.past).toHaveLength(MAX_UNDO_STEPS);
  });

  it('removes connectors attached to deleted elements', () => {
    let s = load();
    s = reducer(s, elementsAdded([shapeEl('a', 'rectangle', 0, 0, 10, 10), shapeEl('b', 'rectangle', 50, 0, 10, 10)]));
    s = reducer(s, elementsAdded([{ ...shapeEl('c', 'rectangle', 0, 0, 0, 0), type: 'connector', data: { from: 'a', to: 'b' } }]));
    s = reducer(s, elementsRemoved(['a']));
    expect(s.elements.map((e) => e.id)).toEqual(['b']);
  });

  it('reorders z-index', () => {
    let s = load();
    s = reducer(s, elementsAdded([shapeEl('a', 'rectangle', 0, 0, 1, 1), shapeEl('b', 'rectangle', 0, 0, 1, 1), shapeEl('c', 'rectangle', 0, 0, 1, 1)]));
    s = reducer(s, elementsReordered({ ids: ['a'], direction: 'front' }));
    const top = [...s.elements].sort((x, y) => y.zIndex - x.zIndex)[0];
    expect(top.id).toBe('a');
  });
});
