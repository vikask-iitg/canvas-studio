import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './env';
import { logger } from './lib/logger';
import { errorHandler, notFound } from './lib/http';
import { LOCAL_UPLOAD_DIR } from './lib/storage';
import { authRouter } from './routes/auth';
import { meRouter } from './routes/me';
import { boardsRouter } from './routes/boards';
import { templatesRouter } from './routes/templates';
import { uploadsRouter } from './routes/uploads';
import { boardShareRouter, sharedRouter } from './routes/shares';
import { cronRouter } from './routes/cron';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
      serializers: { req: (req) => ({ method: req.method, url: req.url }), res: (res) => ({ statusCode: res.statusCode }) },
    }),
  );

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/uploads', express.static(LOCAL_UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

  const api = express.Router();
  // Uploads route parses its own raw body, so mount it before the JSON parser.
  api.use('/uploads', uploadsRouter);
  api.use(express.json({ limit: '6mb' }));
  api.use('/auth', authRouter);
  api.use('/me', meRouter);
  api.use('/boards/:id/share', boardShareRouter);
  api.use('/boards', boardsRouter);
  api.use('/templates', templatesRouter);
  api.use('/shared', sharedRouter);
  api.use('/cron', cronRouter);
  api.use((_req, _res, next) => next(notFound('Route')));

  app.use('/api/v1', api);
  app.use(errorHandler);
  return app;
}
