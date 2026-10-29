import type { Board as DbBoard, Prisma } from '@prisma/client';
import {
  DEFAULT_BACKGROUND,
  ErrorCode,
  FREE_BOARD_LIMIT,
  type Background,
  type Board,
  type BoardContent,
  type BoardSummary,
} from '@canvas/shared';
import { prisma } from './prisma';
import { HttpError, notFound } from './http';

export const summarySelect = {
  id: true,
  title: true,
  isStarred: true,
  thumbnailUrl: true,
  templateId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.BoardSelect;

type SummaryRow = Prisma.BoardGetPayload<{ select: typeof summarySelect }>;

export function toSummary(b: SummaryRow): BoardSummary {
  return {
    id: b.id,
    title: b.title,
    isStarred: b.isStarred,
    thumbnailUrl: b.thumbnailUrl,
    templateId: b.templateId,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    deletedAt: b.deletedAt?.toISOString() ?? null,
  };
}

export function toBoard(b: DbBoard): Board {
  return {
    ...toSummary(b),
    background: { ...DEFAULT_BACKGROUND, ...(b.background as Partial<Background>) },
    content: (b.content as BoardContent | null) ?? { elements: [] },
    version: b.version,
  };
}

export async function getOwnedBoard(id: string, ownerId: string) {
  const board = await prisma.board.findFirst({ where: { id, ownerId } });
  if (!board) throw notFound('Board');
  return board;
}

export async function boardUsage(userId: string) {
  const [user, boards] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } }),
    prisma.board.count({ where: { ownerId: userId, deletedAt: null } }),
  ]);
  return { boards, limit: user.plan === 'free' ? FREE_BOARD_LIMIT : null };
}

/** Throws 403 PLAN_LIMIT when the user cannot hold one more active board. */
export async function assertCanAddBoard(userId: string) {
  const usage = await boardUsage(userId);
  if (usage.limit !== null && usage.boards >= usage.limit) {
    throw new HttpError(403, ErrorCode.PlanLimit, `The free plan includes ${usage.limit} boards. Upgrade or delete a board to continue.`, {
      usage,
    });
  }
}
