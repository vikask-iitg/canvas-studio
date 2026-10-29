import { Router } from 'express';
import { env } from '../env';
import { HttpError, ah } from '../lib/http';
import { purgeTrash } from '../jobs/purgeTrash';

/** Scheduled jobs invoked by Vercel Cron (which sends `Authorization: Bearer $CRON_SECRET`). */
export const cronRouter = Router();

cronRouter.get(
  '/purge-trash',
  ah(async (req, res) => {
    if (!env.cronSecret || req.headers.authorization !== `Bearer ${env.cronSecret}`) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid cron secret');
    }
    res.json({ purged: await purgeTrash() });
  }),
);
