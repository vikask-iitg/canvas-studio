import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';

/**
 * Vercel Function entry: the whole Express API runs as one function. Vercel routes
 * /api/* here with the original path in `__path`, which we restore before Express sees it.
 */
const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const original = url.searchParams.get('__path');
  if (original !== null) {
    url.searchParams.delete('__path');
    const qs = url.searchParams.toString();
    req.url = `/api/${original}${qs ? `?${qs}` : ''}`;
  }
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
