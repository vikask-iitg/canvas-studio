import { Router } from 'express';
import { updateMeSchema } from '@canvas/shared';
import { prisma } from '../lib/prisma';
import { ah, parse } from '../lib/http';
import { requireAuth, serializeUser } from '../lib/auth';
import { boardUsage } from '../lib/boards';

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get(
  '/',
  ah(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
    res.json({ user: serializeUser(user), usage: await boardUsage(user.id) });
  }),
);

meRouter.patch(
  '/',
  ah(async (req, res) => {
    const body = parse(updateMeSchema, req.body);
    const user = await prisma.user.update({ where: { id: req.userId! }, data: body });
    res.json({ user: serializeUser(user), usage: await boardUsage(user.id) });
  }),
);
