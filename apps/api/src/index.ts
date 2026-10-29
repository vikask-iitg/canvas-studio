import { env } from './env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { storageKind } from './lib/storage';
import { seedTemplates } from './jobs/seedTemplates';
import { startPurgeJob } from './jobs/purgeTrash';

async function main() {
  await prisma.$connect();
  await seedTemplates();
  startPurgeJob();
  createApp().listen(env.port, () => {
    logger.info(
      { port: env.port, storage: storageKind },
      `Canvas Studio API listening on http://localhost:${env.port}`,
    );
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'API failed to start');
  process.exit(1);
});
