import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_DIMENSION, MAX_UPLOAD_BYTES, type PresignResponse } from '@canvas/shared';
import { store } from '@/app/store';
import { API_BASE, refreshSession } from './baseApi';
import { credentialsReceived } from '@/features/auth/authSlice';

export class UploadError extends Error {}

export interface UploadedImage {
  url: string;
  width: number;
  height: number;
}

async function presign(body: object): Promise<PresignResponse> {
  const send = () =>
    fetch(`${API_BASE}/uploads/presign`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${store.getState().auth.accessToken ?? ''}` },
      body: JSON.stringify(body),
    });
  let res = await send();
  if (res.status === 401) {
    const s = await refreshSession();
    if (s) store.dispatch(credentialsReceived(s));
    res = await send();
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new UploadError(data?.error?.message ?? 'Upload failed');
  }
  return res.json();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UploadError('That file could not be read as an image'));
    img.src = src;
  });
}

/** Downscales large raster images to MAX_IMAGE_DIMENSION before upload (keeps GIF/SVG as-is). */
async function prepare(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const w = img.naturalWidth || 400;
    const h = img.naturalHeight || 300;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(w, h));
    if (scale === 1 || file.type === 'image/gif' || file.type === 'image/svg+xml') return { blob: file, width: w, height: h };
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(w * scale), height: Math.round(h * scale) });
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, file.type, 0.9));
    return { blob: blob ?? file, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadImage(file: File, boardId?: string): Promise<UploadedImage> {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new UploadError('Only PNG, JPG, SVG and GIF images are supported');
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('Images must be 10 MB or smaller');
  const { blob, width, height } = await prepare(file);
  const signed = await presign({ fileName: file.name || 'image', mimeType: file.type, size: blob.size, boardId });
  if (signed.method === 'BLOB') {
    const { put } = await import('@vercel/blob/client');
    const res = await put(signed.pathname, blob, { access: 'public', token: signed.token, contentType: signed.contentType }).catch(() => {
      throw new UploadError('Upload failed — please try again');
    });
    return { url: res.url, width, height };
  }
  const base = import.meta.env.VITE_API_URL ?? '';
  const put = await fetch(signed.uploadUrl.startsWith('/') ? `${base}${signed.uploadUrl}` : signed.uploadUrl, {
    method: 'PUT',
    headers: signed.headers,
    body: blob,
  });
  if (!put.ok) throw new UploadError('Upload failed — please try again');
  return { url: signed.publicUrl.startsWith('/') ? `${base}${signed.publicUrl}` : signed.publicUrl, width, height };
}
