import { TRASH_RETENTION_DAYS } from '@canvas/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { hardDeleteBoard } from '../routes/boards';

export async function purgeTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expired = await prisma.board.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } });
  for (const b of expired) await hardDeleteBoard(b.id);
  await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  if (expired.length) logger.info({ count: expired.length }, 'Purged boards from trash');
  return expired.length;
}

export function startPurgeJob() {
  const run = () => purgeTrash().catch((err) => logger.error({ err }, 'Trash purge failed'));
  run();
  return setInterval(run, 6 * 60 * 60 * 1000).unref();
}
