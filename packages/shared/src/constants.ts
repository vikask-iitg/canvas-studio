export const FREE_BOARD_LIMIT = 20;
export const TRASH_RETENTION_DAYS = 30;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 2560;
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/gif'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_UNDO_STEPS = 50;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
export const STROKE_WIDTH_MIN = 1;
export const STROKE_WIDTH_MAX = 20;

export const FONT_HANDWRITTEN = 'Caveat';
export const FONT_SANS = 'Inter';

export const STICKY_COLORS = ['#FEF08A', '#FBCFE8', '#BBF7D0', '#BFDBFE', '#FED7AA', '#DDD6FE'] as const;

export const PALETTE = [
  '#111827', '#6B7280', '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#4F46E5', '#A855F7', '#EC4899', '#FFFFFF',
] as const;

/** Error codes the client branches on. */
export const ErrorCode = {
  PlanLimit: 'PLAN_LIMIT',
  VersionConflict: 'VERSION_CONFLICT',
  Validation: 'VALIDATION',
  Unauthorized: 'UNAUTHORIZED',
  NotFound: 'NOT_FOUND',
} as const;
