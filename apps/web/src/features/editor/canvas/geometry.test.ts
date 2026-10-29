import { describe, expect, it } from 'vitest';
import { shapeEl } from '@canvas/shared';
import { connectorEndpoints, elementBounds, fitRect, zoomAround } from './geometry';

describe('geometry', () => {
  it('bounds a rotated element', () => {
    const el = { ...shapeEl('a', 'rectangle', 0, 0, 100, 0.0001), rotation: 90 };
    const b = elementBounds(el);
    expect(b.height).toBeCloseTo(100);
  });

  it('clips connector endpoints to the element edges', () => {
    const a = shapeEl('a', 'rectangle', 0, 0, 100, 100);
    const b = shapeEl('b', 'rectangle', 300, 0, 100, 100);
    const ends = connectorEndpoints({ ...a, id: 'c', type: 'connector', data: { from: 'a', to: 'b' } }, new Map([['a', a], ['b', b]]))!;
    expect(ends[0]).toBeCloseTo(106);
    expect(ends[2]).toBeCloseTo(294);
  });

  it('keeps the point under the cursor fixed when zooming', () => {
    const vp = zoomAround({ x: 0, y: 0, scale: 1 }, 2, { x: 100, y: 100 });
    expect((100 - vp.x) / vp.scale).toBeCloseTo(100);
  });

  it('clamps fit-to-content zoom to 10%–400%', () => {
    expect(fitRect({ x: 0, y: 0, width: 1e6, height: 1e6 }, 800, 600).scale).toBe(0.1);
  });
});
