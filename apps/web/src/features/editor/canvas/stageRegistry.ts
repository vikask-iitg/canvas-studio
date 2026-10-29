import type Konva from 'konva';

/** The live editor stage, so export/thumbnail code can reach Konva outside React. */
export const stageRegistry: { stage: Konva.Stage | null } = { stage: null };
export const CONTENT_LAYER_NAME = 'content-layer';
