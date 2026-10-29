import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { sanitizeSvg } from './lib/storage';

const app = createApp();

describe('API (no database required)', () => {
  it('reports health', async () => {
    await request(app).get('/health').expect(200, { ok: true });
  });

  it('rejects board routes without a bearer token', async () => {
    const res = await request(app).get('/api/v1/boards').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid access tokens', async () => {
    const res = await request(app).patch('/api/v1/boards/x').set('Authorization', 'Bearer x').send({}).expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/v1/nope').set('Authorization', 'Bearer x').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('strips scripts and handlers from SVG uploads', () => {
    const dirty = '<svg onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><rect/></a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/onload|<script|javascript:/i);
    expect(clean).toContain('<rect/>');
  });
});
