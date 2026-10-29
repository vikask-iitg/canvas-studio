import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { ErrorCode, welcomeBoard } from '@canvas/shared';
import { prisma } from '../lib/prisma';
import { HttpError, ah } from '../lib/http';
import { REFRESH_COOKIE, clearRefreshCookie, consumeRefreshToken, issueRefreshToken, serializeUser, signAccessToken } from '../lib/auth';

/**
 * There is no sign-in: each browser gets its own guest account on first visit, kept
 * by the rotating httpOnly refresh cookie.
 */
export const authRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

authRouter.post(
  '/guest',
  limiter,
  ah(async (_req, res) => {
    const user = await prisma.user.create({
      data: { email: `guest-${crypto.randomUUID()}@guest.local`, name: 'Guest' },
    });
    const w = welcomeBoard();
    await prisma.board.create({
      data: { ownerId: user.id, title: w.title, background: w.background, content: { elements: w.elements } },
    });
    await issueRefreshToken(res, user.id);
    res.status(201).json({ accessToken: signAccessToken(user.id), user: serializeUser(user) });
  }),
);

authRouter.post(
  '/refresh',
  ah(async (req, res) => {
    const userId = await consumeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!user) {
      clearRefreshCookie(res);
      throw new HttpError(401, ErrorCode.Unauthorized, 'Session expired');
    }
    await issueRefreshToken(res, user.id);
    res.json({ accessToken: signAccessToken(user.id), user: serializeUser(user) });
  }),
);
