import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { User as DbUser } from '@prisma/client';
import { ErrorCode, type User } from '@canvas/shared';
import { env } from '../env';
import { prisma } from './prisma';
import { HttpError } from './http';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE = 'cs_refresh';

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: ACCESS_TTL });
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Issues a new refresh token, stores its hash and sets the httpOnly cookie. */
export async function issueRefreshToken(res: Response, userId: string) {
  const token = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    path: '/api/v1/auth',
    maxAge: REFRESH_TTL_MS,
  });
}

/** Consumes a refresh token (rotation): returns its user id or null when invalid/expired. */
export async function consumeRefreshToken(token: string | undefined) {
  if (!token) return null;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row) return null;
  await prisma.refreshToken.delete({ where: { id: row.id } }).catch(() => undefined);
  return row.expiresAt > new Date() ? row.userId : null;
}

export async function revokeRefreshToken(token: string | undefined) {
  if (token) await prisma.refreshToken.deleteMany({ where: { tokenHash: sha256(token) } });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(new HttpError(401, ErrorCode.Unauthorized, 'Not signed in'));
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, ErrorCode.Unauthorized, 'Session expired'));
  }
}

export function serializeUser(u: DbUser): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    authProvider: u.authProvider,
    theme: u.theme === 'dark' ? 'dark' : 'light',
    plan: u.plan,
    createdAt: u.createdAt.toISOString(),
  };
}
