import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_BACKGROUND,
  ErrorCode,
  createBoardSchema,
  listBoardsQuerySchema,
  thumbnailSchema,
  updateBoardSchema,
} from '@canvas/shared';
import { prisma } from '../lib/prisma';
import { HttpError, ah, notFound, parse } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { assertCanAddBoard, getOwnedBoard, summarySelect, toBoard, toSummary } from '../lib/boards';
import { storage } from '../lib/storage';

export const boardsRouter = Router();
boardsRouter.use(requireAuth);

boardsRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(listBoardsQuerySchema, req.query);
    const where: Prisma.BoardWhereInput = { ownerId: req.userId!, deletedAt: q.view === 'trash' ? { not: null } : null };
    if (q.view === 'starred') where.isStarred = true;
    if (q.view === 'recent') where.lastOpenedAt = { not: null };
    if (q.q) where.title = { contains: q.q, mode: 'insensitive' };

    const orderBy: Prisma.BoardOrderByWithRelationInput =
      q.view === 'recent'
        ? { lastOpenedAt: 'desc' }
        : q.view === 'trash'
          ? { deletedAt: 'desc' }
          : q.sort === 'name'
            ? { title: 'asc' }
            : q.sort === 'created'
              ? { createdAt: 'desc' }
              : { updatedAt: 'desc' };

    const take = q.view === 'recent' ? Math.min(q.pageSize, 20) : q.pageSize;
    const [rows, total] = await Promise.all([
      prisma.board.findMany({ where, orderBy, skip: (q.page - 1) * take, take, select: summarySelect }),
      prisma.board.count({ where }),
    ]);
    res.json({ items: rows.map(toSummary), total: q.view === 'recent' ? Math.min(total, 20) : total, page: q.page, pageSize: take });
  }),
);

boardsRouter.post(
  '/',
  ah(async (req, res) => {
    const body = parse(createBoardSchema, req.body ?? {});
    await assertCanAddBoard(req.userId!);
    let background: object = DEFAULT_BACKGROUND;
    let content: object = { elements: [] };
    let title = body.title ?? 'Untitled board';
    if (body.templateId) {
      const tpl = await prisma.template.findUnique({ where: { id: body.templateId } });
      if (!tpl) throw notFound('Template');
      background = tpl.background as object;
      content = tpl.content as object;
      if (!body.title) title = tpl.id === 'tpl_blank' ? 'Untitled board' : tpl.name;
    }
    const board = await prisma.board.create({
      data: { ownerId: req.userId!, title, background, content, templateId: body.templateId ?? null, lastOpenedAt: new Date() },
    });
    res.status(201).json(toBoard(board));
  }),
);

boardsRouter.get(
  '/:id',
  ah(async (req, res) => {
    const board = await getOwnedBoard(req.params.id, req.userId!);
    await prisma.board.update({ where: { id: board.id }, data: { lastOpenedAt: new Date() } });
    res.json(toBoard(board));
  }),
);

boardsRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const body = parse(updateBoardSchema, req.body);
    const board = await getOwnedBoard(req.params.id, req.userId!);
    const now = new Date();
    const data: Prisma.BoardUpdateInput = {};
    if (body.title !== undefined) {
      data.title = body.title;
      data.updatedAt = now;
    }
    if (body.isStarred !== undefined) data.isStarred = body.isStarred;

    if (body.content !== undefined || body.background !== undefined) {
      // Optimistic concurrency: only apply when the client saw the latest version.
      const result = await prisma.board.updateMany({
        where: { id: board.id, version: body.version },
        data: {
          ...(data as Prisma.BoardUpdateManyMutationInput),
          ...(body.content ? { content: body.content } : {}),
          ...(body.background ? { background: body.background } : {}),
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      if (result.count === 0) {
        const current = toBoard(await getOwnedBoard(board.id, req.userId!));
        throw new HttpError(409, ErrorCode.VersionConflict, 'This board was changed somewhere else', {
          current: { version: current.version, background: current.background, content: current.content, updatedAt: current.updatedAt },
        });
      }
    } else if (Object.keys(data).length) {
      await prisma.board.update({ where: { id: board.id }, data });
    }
    const updated = await prisma.board.findUniqueOrThrow({ where: { id: board.id }, select: { ...summarySelect, version: true } });
    res.json({ ...toSummary(updated), version: updated.version });
  }),
);

boardsRouter.post(
  '/:id/duplicate',
  ah(async (req, res) => {
    const src = await getOwnedBoard(req.params.id, req.userId!);
    await assertCanAddBoard(req.userId!);
    const copy = await prisma.board.create({
      data: {
        ownerId: req.userId!,
        title: `${src.title} (copy)`.slice(0, 120),
        background: src.background as object,
        content: src.content as object,
        templateId: src.templateId,
      },
    });
    res.status(201).json(toBoard(copy));
  }),
);

boardsRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const board = await getOwnedBoard(req.params.id, req.userId!);
    await prisma.board.update({ where: { id: board.id }, data: { deletedAt: new Date(), isStarred: false } });
    res.status(204).end();
  }),
);

boardsRouter.post(
  '/:id/restore',
  ah(async (req, res) => {
    const board = await getOwnedBoard(req.params.id, req.userId!);
    if (board.deletedAt) await assertCanAddBoard(req.userId!);
    const restored = await prisma.board.update({ where: { id: board.id }, data: { deletedAt: null }, select: summarySelect });
    res.json(toSummary(restored));
  }),
);

boardsRouter.delete(
  '/:id/permanent',
  ah(async (req, res) => {
    const board = await getOwnedBoard(req.params.id, req.userId!);
    await hardDeleteBoard(board.id);
    res.status(204).end();
  }),
);

boardsRouter.post(
  '/:id/thumbnail',
  ah(async (req, res) => {
    const board = await getOwnedBoard(req.params.id, req.userId!);
    const { dataUrl } = parse(thumbnailSchema, req.body);
    const buf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
    // Unique key per render so CDNs never serve a stale thumbnail; the previous file is removed.
    const thumbnailUrl = await storage.put(`thumbnails/${board.id}/${Date.now()}.png`, buf, 'image/png');
    await prisma.board.update({ where: { id: board.id }, data: { thumbnailUrl } });
    if (board.thumbnailUrl) storage.removeUrl(board.thumbnailUrl).catch(() => undefined);
    res.json({ thumbnailUrl });
  }),
);

export async function hardDeleteBoard(boardId: string) {
  const assets = await prisma.asset.findMany({ where: { boardId }, select: { key: true } });
  const board = await prisma.board.delete({ where: { id: boardId }, select: { thumbnailUrl: true } });
  await Promise.allSettled([...assets.map((a) => storage.remove(a.key)), ...(board.thumbnailUrl ? [storage.removeUrl(board.thumbnailUrl)] : [])]);
  await prisma.asset.deleteMany({ where: { boardId: null, key: { in: assets.map((a) => a.key) } } });
}
