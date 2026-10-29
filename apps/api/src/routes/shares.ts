import crypto from 'node:crypto';
import { Router } from 'express';
import { DEFAULT_BACKGROUND, type Background, type BoardContent, type SharedBoard } from '@canvas/shared';
import { prisma } from '../lib/prisma';
import { ah, notFound } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { getOwnedBoard } from '../lib/boards';

/** Mounted under /boards/:id/share */
export const boardShareRouter = Router({ mergeParams: true });
boardShareRouter.use(requireAuth);

const activeShare = (boardId: string) =>
  prisma.boardShare.findFirst({ where: { boardId, token: { not: null }, revokedAt: null }, orderBy: { createdAt: 'desc' } });

boardShareRouter.get(
  '/',
  ah(async (req, res) => {
    const board = await getOwnedBoard((req.params as { id: string }).id, req.userId!);
    const share = await activeShare(board.id);
    res.json(share ? { token: share.token, createdAt: share.createdAt.toISOString() } : null);
  }),
);

boardShareRouter.post(
  '/',
  ah(async (req, res) => {
    const board = await getOwnedBoard((req.params as { id: string }).id, req.userId!);
    const share =
      (await activeShare(board.id)) ??
      (await prisma.boardShare.create({ data: { boardId: board.id, token: crypto.randomBytes(18).toString('base64url'), role: 'viewer' } }));
    res.status(201).json({ token: share.token, createdAt: share.createdAt.toISOString() });
  }),
);

boardShareRouter.delete(
  '/',
  ah(async (req, res) => {
    const board = await getOwnedBoard((req.params as { id: string }).id, req.userId!);
    await prisma.boardShare.updateMany({ where: { boardId: board.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.status(204).end();
  }),
);

/** Public, read-only access by token. */
export const sharedRouter = Router();

sharedRouter.get(
  '/:token',
  ah(async (req, res) => {
    const share = await prisma.boardShare.findUnique({
      where: { token: req.params.token },
      include: { board: { include: { owner: { select: { name: true } } } } },
    });
    if (!share || share.revokedAt || share.board.deletedAt) throw notFound('Shared board');
    const b = share.board;
    const body: SharedBoard = {
      id: b.id,
      title: b.title,
      background: { ...DEFAULT_BACKGROUND, ...(b.background as Partial<Background>) },
      content: b.content as BoardContent,
      ownerName: b.owner.name,
      updatedAt: b.updatedAt.toISOString(),
    };
    res.json(body);
  }),
);
