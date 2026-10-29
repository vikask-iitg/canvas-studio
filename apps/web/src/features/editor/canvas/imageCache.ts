import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      if (!src.startsWith('data:') && !src.startsWith('/')) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        cache.delete(src);
        reject(new Error(`Failed to load ${src}`));
      };
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

export function useImage(src: string | null | undefined) {
  const [state, setState] = useState<{ src?: string; img: HTMLImageElement | null; failed: boolean }>({ img: null, failed: false });
  useEffect(() => {
    if (!src) return;
    let alive = true;
    loadImage(src).then(
      (img) => alive && setState({ src, img, failed: false }),
      () => alive && setState({ src, img: null, failed: true }),
    );
    return () => {
      alive = false;
    };
  }, [src]);
  return state.src === src ? state : { img: null, failed: false };
}
