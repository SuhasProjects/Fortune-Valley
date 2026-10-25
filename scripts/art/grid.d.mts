// Types for grid.mjs so tests (type-checked) can import it.
export interface Frame { name: string; rows: string[][] }
export interface GridMeta { w: number; h: number; frames: number; anchor: [number, number] | null; slice: number | null; variants: string[]; speed: number | null; export2x: boolean; kind: string }
export type Palette = Map<string, { name: string; rgba: number[] }>
export function hexToRgba(hex: string | null): number[]
export function paletteMap(colors: { key: string; name: string; hex: string | null }[]): Palette
export function parseGrid(text: string, palette: Palette, file?: string): { meta: GridMeta; frames: Frame[] }
export function outlineFrame(frame: Frame, key?: string): Frame
export function litFrame(frame: Frame): Frame
export function lightsFrame(frame: Frame): Frame
export function expandFrames(parsed: { meta: GridMeta; frames: Frame[] }, file?: string): Frame[]
export function renderSheet(frames: Frame[], palette: Palette, scale?: number): { width: number; height: number; data: Uint8Array }
export function pngBytes(png: unknown): Uint8Array
export function formatGrid(meta: Partial<GridMeta> & { w: number; h: number }, frames: Frame[]): string
