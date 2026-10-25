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
/** Side of the square grass-and-pines tile that fills whatever a window shows past the map (art px). */
export const EDGE_TILE = 48;

export interface StageScale { px: number; viewW: number; viewH: number }

/**
 * Whole-number zoom for a viewport; never fractional, never below MIN_SCALE.
 *
 * The rule: `px = floor(min(width / CORE_W, height / CORE_H))`, the largest zoom at which the whole 320x180 core
 * fits. Odd aspect ratios then show more than the 480x288 map on one axis (a 1024x1366 portrait tablet at zoom 3 is
 * 341x455 art px; a 5120x1440 ultrawide at zoom 8 is 640x180). Raising the zoom one step would always cut the
 * core, because `floor` already picked the largest zoom that holds it, so the stage never does that: `mapWindow`
 * centres the map and the window beyond it is filled with the `world/edge-tile` border (never a flat colour), and
 * `uiBox` keeps the HUD, bars and bubbles anchored to the map's edges rather than the viewport's.
 */
export function stageScale(width: number, height: number): StageScale {
  const px = Math.max(MIN_SCALE, Math.floor(Math.min(width / CORE_W, height / CORE_H)));
  return { px, viewW: width / px, viewH: height / px };
}

export interface MapWindow {
  /** Map's top-left corner in CSS px relative to the stage (negative when the map is larger than the viewport). */
  left: number; top: number;
  /** True when the viewport shows past the map on that axis (the edge border is visible there). */
  wide: boolean; tall: boolean;
}

/**
 * Where the 480x288 map sits in a `width` x `height` viewport: centred, except that a short viewport (fewer than
 * MAP_H rows) may instead keep its top edge at `topMax` art px so the HUD does not cover the top row of buildings.
 * The window is always clamped inside 0..MAP_W x 0..MAP_H when it is smaller than the map; when it is larger, the
 * map is centred and `wide`/`tall` say which edges show the border.
 */
export function mapWindow(width: number, height: number, { px, viewW, viewH }: StageScale, topMax = CORE_OFFSET_Y): MapWindow {
  const wide = viewW > MAP_W, tall = viewH > MAP_H;
  const left = Math.round((width - MAP_W * px) / 2);
  const top = tall ? Math.round((height - MAP_H * px) / 2) : -Math.round(Math.min((MAP_H - viewH) / 2, topMax) * px);
  return { left, top, wide, tall };
}

export interface UiBox { left: number; top: number; right: number; bottom: number }

/**
 * The UI layer's inset from the viewport edges, CSS px: zero where the map reaches the edge, otherwise the strip of
 * border that shows there, so the HUD, control bar, toasts and bubbles sit on the map, not out on the pines. Uses the
 * same rounding as `mapWindow` so the HUD's top edge is the map's top edge.
 */
export function uiBox(width: number, height: number, { px }: StageScale): UiBox {
  const w = MAP_W * px, h = MAP_H * px;
  const left = Math.max(0, Math.round((width - w) / 2));
  const top = Math.max(0, Math.round((height - h) / 2));
  return { left, top, right: Math.max(0, width - left - w), bottom: Math.max(0, height - top - h) };
}
