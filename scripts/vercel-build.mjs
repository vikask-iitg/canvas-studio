/**
 * Vercel build: emits the Build Output API (v3) directly so routing is explicit.
 *   - static/            the Vite SPA
 *   - functions/api.func the whole Express API bundled into one Node function
 * Also applies database migrations and refreshes the built-in templates.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const OUT = '.vercel/output';
const FUNC = `${OUT}/functions/api.func`;
const SCHEMA = 'apps/api/prisma/schema.prisma';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

fs.rmSync(OUT, { recursive: true, force: true });

run(`npx prisma generate --schema ${SCHEMA}`);
if (process.env.DATABASE_URL && !process.env.SKIP_DB) {
  run(`npx prisma migrate deploy --schema ${SCHEMA}`);
  run('npx tsx apps/api/src/scripts/seed.ts');
} else {
  console.warn('DATABASE_URL not set (or SKIP_DB) — skipping migrations and seeding');
}

// ---- Static site ----
run('npm run build -w @canvas/web');
fs.cpSync('apps/web/dist', `${OUT}/static`, { recursive: true });

// ---- API function ----
await build({
  entryPoints: ['apps/api/src/vercel.ts'],
  outfile: `${FUNC}/index.js`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  // Prisma loads its generated client + native engine from disk; copied below.
  external: ['@prisma/client', '.prisma/client', 'pino-pretty'],
  logLevel: 'info',
});

// Ship the generated Prisma client, keeping only the Linux engine on Vercel.
const onVercel = Boolean(process.env.VERCEL);
for (const dir of ['@prisma/client', '.prisma/client']) {
  fs.cpSync(path.join('node_modules', dir), path.join(FUNC, 'node_modules', dir), {
    recursive: true,
    dereference: true,
    filter: (src) => !(onVercel && /libquery_engine-(darwin|debian|linux-musl)/.test(src)),
  });
}

fs.writeFileSync(
  `${FUNC}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30 }, null, 2),
);

fs.writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '^/api/(.*)$', dest: '/api?__path=$1' },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
      crons: [{ path: '/api/v1/cron/purge-trash', schedule: '0 3 * * *' }],
    },
    null,
    2,
  ),
);

console.log('Build Output ready in .vercel/output');
