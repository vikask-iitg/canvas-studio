import { del, get, set } from 'idb-keyval';
import type { Background, CanvasElement } from '@canvas/shared';

/** Unsaved board state kept in IndexedDB so a closed tab or dropped network never loses work. */
export interface LocalBackup {
  boardId: string;
  baseVersion: number;
  background: Background;
  elements: CanvasElement[];
  savedAt: number;
}

const key = (boardId: string) => `cs-backup:${boardId}`;

export const readBackup = (boardId: string) => get<LocalBackup>(key(boardId)).catch(() => undefined);
export const writeBackup = (b: LocalBackup) => set(key(b.boardId), b).catch(() => undefined);
export const clearBackup = (boardId: string) => del(key(boardId)).catch(() => undefined);
