// Shared geometry for the art scripts (mirrors src/game/stage/scale.ts). Owner: Agent 1.
export const MAP_W = 480;
export const MAP_H = 288;
export const CORE_W = 320;
export const CORE_H = 180;
export const CORE_OFFSET = [(MAP_W - CORE_W) / 2, (MAP_H - CORE_H) / 2];
/** The reference town (294x171 art px at cell 6.9) sits here inside the core so its layout is reproduced exactly. */
export const REF_OFFSET = [13, 4];
export const REF_CELL = 6.9;
