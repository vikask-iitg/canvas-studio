import path from 'node:path';
import express, { Router } from 'express';
import { nanoid } from 'nanoid';
import { MAX_UPLOAD_BYTES, presignSchema } from '@canvas/shared';
import { prisma } from '../lib/prisma';
import { HttpError, ah, parse } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { getOwnedBoard } from '../lib/boards';
import { sanitizeSvg, signLocalUpload, storage, storageKind } from '../lib/storage';

export const uploadsRouter = Router();

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg', 'image/gif': 'gif' };

uploadsRouter.post(
  '/presign',
  express.json(),
  requireAuth,
  ah(async (req, res) => {
    const body = parse(presignSchema, req.body);
    if (body.boardId) await getOwnedBoard(body.boardId, req.userId!);
    const key = `images/${req.userId}/${nanoid(16)}.${EXT[body.mimeType]}`;
    const signed = await storage.presignUpload(key, body.mimeType, body.size);
    const asset = await prisma.asset.create({
      data: { ownerId: req.userId!, boardId: body.boardId ?? null, key, url: signed.method === 'PUT' ? signed.publicUrl : key, mimeType: body.mimeType, sizeBytes: body.size },
    });
    res.json({ ...signed, assetId: asset.id });
  }),
);

// Local-disk stand-in for an S3 pre-signed PUT. Authorised by the HMAC signature, not the session.
if (storageKind === 'local') {
  uploadsRouter.put(
    /^\/local\/(.+)$/,
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
    ah(async (req, res) => {
      const key = (req.params as Record<string, string>)[0];
      const { mime = '', size = '', expires = '', sig = '' } = req.query as Record<string, string>;
      const valid =
        Number(expires) > Date.now() &&
        sig === signLocalUpload(key, mime, Number(size), Number(expires)) &&
        req.headers['content-type'] === mime &&
        Buffer.isBuffer(req.body) &&
        req.body.length === Number(size) &&
        !path.normalize(key).includes('..');
      if (!valid) throw new HttpError(403, 'BAD_SIGNATURE', 'Upload URL is invalid or expired');
      const body = mime === 'image/svg+xml' ? Buffer.from(sanitizeSvg(req.body.toString('utf8'))) : req.body;
      await storage.put(key, body, mime);
      res.status(200).end();
    }),
  );
}
