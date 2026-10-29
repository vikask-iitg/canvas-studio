/**
 * Runs a real PostgreSQL server for local development without Docker or a system install.
 * Data lives in apps/api/.pgdata. Keep this running in its own terminal.
 */
import path from 'node:path';
import fs from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const dataDir = path.resolve(process.cwd(), '.pgdata');
const firstRun = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: 5433, persistent: true });

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase('canvas_studio');
console.log('Postgres ready on postgresql://postgres:postgres@localhost:5433/canvas_studio (Ctrl+C to stop)');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
