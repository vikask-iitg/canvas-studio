import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { del as blobDel, put as blobPut } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { MAX_UPLOAD_BYTES } from '@canvas/shared';
import { env } from '../env';

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/** How the browser should upload a file: a pre-signed PUT, or a Vercel Blob client token. */
export type PresignedUpload =
  | { method: 'PUT'; uploadUrl: string; headers: Record<string, string>; publicUrl: string }
  | { method: 'BLOB'; token: string; pathname: string; contentType: string };

export interface Storage {
  presignUpload(key: string, mimeType: string, size: number): Promise<PresignedUpload>;
  /** Server-side write (thumbnails). Returns the public URL. */
  put(key: string, body: Buffer, mimeType: string): Promise<string>;
  remove(key: string): Promise<void>;
  /** Deletes an object given the public URL this storage handed out. */
  removeUrl(url: string): Promise<void>;
}

class S3Storage implements Storage {
  private client = new S3Client({
    region: env.s3.region,
    endpoint: env.s3.endpoint || undefined,
    credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
  });

  private base = env.s3.publicUrl.replace(/\/$/, '');

  async presignUpload(key: string, mimeType: string, size: number): Promise<PresignedUpload> {
    const cmd = new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, ContentType: mimeType, ContentLength: size });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 300 });
    return { method: 'PUT', uploadUrl, headers: { 'Content-Type': mimeType }, publicUrl: `${this.base}/${key}` };
  }

  async put(key: string, body: Buffer, mimeType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: body, ContentType: mimeType }));
    return `${this.base}/${key}`;
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
  }

  async removeUrl(url: string) {
    if (url.startsWith(this.base)) await this.remove(url.slice(this.base.length + 1).split('?')[0]);
  }
}

/** Vercel Blob: the browser uploads directly with a short-lived, constrained client token. */
class BlobStorage implements Storage {
  private token = env.blobToken;

  async presignUpload(key: string, mimeType: string, size: number): Promise<PresignedUpload> {
    const token = await generateClientTokenFromReadWriteToken({
      token: this.token,
      pathname: key,
      allowedContentTypes: [mimeType],
      maximumSizeInBytes: Math.min(size, MAX_UPLOAD_BYTES),
      validUntil: Date.now() + 5 * 60_000,
      addRandomSuffix: false,
    });
    return { method: 'BLOB', token, pathname: key, contentType: mimeType };
  }

  async put(key: string, body: Buffer, mimeType: string) {
    const res = await blobPut(key, body, { access: 'public', token: this.token, contentType: mimeType, addRandomSuffix: false, allowOverwrite: true });
    return res.url;
  }

  async remove(key: string) {
    await blobDel(key, { token: this.token });
  }

  async removeUrl(url: string) {
    if (url.includes('.blob.vercel-storage.com/')) await blobDel(url.split('?')[0], { token: this.token });
  }
}

/**
 * Dev fallback that mimics pre-signed uploads: the browser PUTs to an HMAC-signed API URL
 * and files are served from /uploads.
 */
class LocalStorage implements Storage {
  async presignUpload(key: string, mimeType: string, size: number): Promise<PresignedUpload> {
    const expires = Date.now() + 5 * 60_000;
    const sig = signLocalUpload(key, mimeType, size, expires);
    const qs = new URLSearchParams({ mime: mimeType, size: String(size), expires: String(expires), sig });
    return { method: 'PUT', uploadUrl: `/api/v1/uploads/local/${key}?${qs}`, headers: { 'Content-Type': mimeType }, publicUrl: `/uploads/${key}` };
  }

  async put(key: string, body: Buffer) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    return `/uploads/${key}`;
  }

  async remove(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }

  async removeUrl(url: string) {
    if (url.startsWith('/uploads/')) await this.remove(url.slice('/uploads/'.length).split('?')[0]);
  }

  private resolve(key: string) {
    const file = path.resolve(LOCAL_UPLOAD_DIR, key);
    if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) throw new Error('Invalid key');
    return file;
  }
}

export function signLocalUpload(key: string, mime: string, size: number, expires: number) {
  return crypto.createHmac('sha256', env.jwtSecret).update(`${key}|${mime}|${size}|${expires}`).digest('hex');
}

export const usingS3 = Boolean(env.s3.bucket && env.s3.accessKeyId);
export const usingBlob = !usingS3 && Boolean(env.blobToken);
export const storageKind = usingS3 ? 's3' : usingBlob ? 'vercel-blob' : 'local';
export const storage: Storage = usingS3 ? new S3Storage() : usingBlob ? new BlobStorage() : new LocalStorage();

/** Strips scripts, event handlers and external references from an uploaded SVG. */
export function sanitizeSvg(svg: string) {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
}
