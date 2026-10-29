import { z } from 'zod';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from './constants';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #AABBCC');
const coord = z.number().finite();

// ---------- Background ----------

export const BACKGROUND_TYPES = ['plain', 'grid', 'dots', 'lined', 'isometric', 'graph', 'texture', 'image'] as const;
export type BackgroundType = (typeof BACKGROUND_TYPES)[number];

export const gridSettingsSchema = z.object({
  spacing: z.number().int().min(8).max(64),
  lineColor: hex,
  lineWidth: z.number().min(1).max(4),
  opacity: z.number().min(0).max(1),
});
export type GridSettings = z.infer<typeof gridSettingsSchema>;

export const backgroundSchema = z.object({
  type: z.enum(BACKGROUND_TYPES),
  color: hex,
  grid: gridSettingsSchema,
  imageUrl: z.string().max(2048).nullable(),
  imageFit: z.enum(['cover', 'tile']),
});
export type Background = z.infer<typeof backgroundSchema>;

export const DEFAULT_BACKGROUND: Background = {
  type: 'plain',
  color: '#FFFFFF',
  grid: { spacing: 24, lineColor: '#E5E7EB', lineWidth: 1, opacity: 0.4 },
  imageUrl: null,
  imageFit: 'cover',
};

// ---------- Elements ----------

export const ELEMENT_TYPES = ['stroke', 'shape', 'text', 'image', 'sticky', 'connector'] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

export const SHAPE_KINDS = ['rectangle', 'ellipse', 'triangle', 'diamond', 'star', 'line', 'arrow'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export const elementStyleSchema = z.object({
  stroke: z.string().max(32).optional(),
  strokeWidth: z.number().min(0).max(64).optional(),
  fill: z.string().max(32).optional(),
  fontFamily: z.string().max(64).optional(),
  fontSize: z.number().min(4).max(400).optional(),
  /** 0 = clean geometry, >0 = hand-drawn (Rough.js roughness). */
  roughness: z.number().min(0).max(3).optional(),
  opacity: z.number().min(0).max(1).optional(),
  seed: z.number().int().optional(),
});
export type ElementStyle = z.infer<typeof elementStyleSchema>;

export const elementDataSchema = z.object({
  points: z.array(z.array(coord).min(2).max(3)).max(20000).optional(),
  shape: z.enum(SHAPE_KINDS).optional(),
  text: z.string().max(20000).optional(),
  src: z.string().max(2048).optional(),
  from: z.string().max(64).optional(),
  to: z.string().max(64).optional(),
});
export type ElementData = z.infer<typeof elementDataSchema>;

export const elementSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(ELEMENT_TYPES),
  x: coord,
  y: coord,
  width: coord,
  height: coord,
  rotation: coord,
  zIndex: coord,
  locked: z.boolean(),
  groupId: z.string().max(64).nullable().optional(),
  style: elementStyleSchema,
  data: elementDataSchema,
});
export type CanvasElement = z.infer<typeof elementSchema>;

export const boardContentSchema = z.object({
  elements: z.array(elementSchema).max(20000),
});
export type BoardContent = z.infer<typeof boardContentSchema>;

// ---------- Auth / account ----------

export const THEMES = ['light', 'dark'] as const;
export const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  theme: z.enum(THEMES).optional(),
  avatarUrl: z.string().max(2048).nullable().optional(),
});

// ---------- Boards ----------

export const BOARD_VIEWS = ['all', 'recent', 'starred', 'trash'] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];
export const BOARD_SORTS = ['recent', 'name', 'created'] as const;
export type BoardSort = (typeof BOARD_SORTS)[number];

export const listBoardsQuerySchema = z.object({
  view: z.enum(BOARD_VIEWS).default('all'),
  q: z.string().trim().max(100).default(''),
  sort: z.enum(BOARD_SORTS).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const createBoardSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  templateId: z.string().max(64).optional(),
});

export const updateBoardSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    isStarred: z.boolean().optional(),
    background: backgroundSchema.optional(),
    content: boardContentSchema.optional(),
    version: z.number().int().min(1).optional(),
  })
  .refine((v) => (v.background === undefined && v.content === undefined) || v.version !== undefined, {
    message: 'version is required when updating background or content',
    path: ['version'],
  });
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

export const thumbnailSchema = z.object({
  dataUrl: z.string().startsWith('data:image/png;base64,').max(1_500_000),
});

export const presignSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z.number().int().min(1).max(MAX_UPLOAD_BYTES, 'Images must be 10 MB or smaller'),
  boardId: z.string().max(64).optional(),
});

// ---------- API response shapes ----------

export type Plan = 'free' | 'pro';
export type Theme = (typeof THEMES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  authProvider: 'email' | 'google';
  theme: Theme;
  plan: Plan;
  createdAt: string;
}

export interface Usage {
  boards: number;
  limit: number | null;
}

export interface MeResponse {
  user: User;
  usage: Usage;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface BoardSummary {
  id: string;
  title: string;
  isStarred: boolean;
  thumbnailUrl: string | null;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Board extends BoardSummary {
  background: Background;
  content: BoardContent;
  version: number;
}

export interface BoardList {
  items: BoardSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  background: Background;
  content: BoardContent;
  isSystem: boolean;
}

/** Either a pre-signed PUT (S3 / local) or a Vercel Blob client token. */
export type PresignResponse = { assetId: string } & (
  | { method: 'PUT'; uploadUrl: string; headers: Record<string, string>; publicUrl: string }
  | { method: 'BLOB'; token: string; pathname: string; contentType: string }
);

export interface ShareLink {
  token: string;
  createdAt: string;
}

export interface SharedBoard {
  id: string;
  title: string;
  background: Background;
  content: BoardContent;
  ownerName: string;
  updatedAt: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface VersionConflictBody extends ApiErrorBody {
  current: { version: number; background: Background; content: BoardContent; updatedAt: string };
}
