/** Logical size of the town core in art pixels (16:9). The stage always shows all of it. */
export const CORE_W = 320;
export const CORE_H = 180;
/** Decorative map around the core, so wider or taller windows show more valley. */
export const MAP_W = 480;
export const MAP_H = 288;
export const CORE_OFFSET_X = (MAP_W - CORE_W) / 2;
export const CORE_OFFSET_Y = (MAP_H - CORE_H) / 2;
export const MIN_SCALE = 1;
/** Height of the HUD bar laid over the top of the viewport (art px); the world keeps its buildings below it. */
export const HUD_H = 22;
/** Distance from the viewport bottom to the control bar's top edge (art px); matches --bar-top in GameScreen.css. */
export const BAR_TOP = 25;

export interface StageScale { px: number; viewW: number; viewH: number }

/** Whole-number zoom that fits the core in the viewport; never fractional, never below MIN_SCALE. */
export function stageScale(width: number, height: number): StageScale {
  const px = Math.max(MIN_SCALE, Math.floor(Math.min(width / CORE_W, height / CORE_H)));
  return { px, viewW: width / px, viewH: height / px };
}
