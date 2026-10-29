import { Router } from 'express';
import { DEFAULT_BACKGROUND, type Background, type BoardContent, type Template } from '@canvas/shared';
import { prisma } from '../lib/prisma';
import { ah } from '../lib/http';

export const templatesRouter = Router();

templatesRouter.get(
  '/',
  ah(async (_req, res) => {
    const rows = await prisma.template.findMany({ where: { isSystem: true }, orderBy: { sortOrder: 'asc' } });
    const items: Template[] = rows.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      background: { ...DEFAULT_BACKGROUND, ...(t.background as Partial<Background>) },
      content: t.content as BoardContent,
      isSystem: t.isSystem,
    }));
    res.set('Cache-Control', 'public, max-age=300').json(items);
  }),
);
