// Types for water.mjs (consumed by tests/art/water.test.ts). Owner: Agent 1.
export const MASK_PATH: string;
export const RIVER_BOX: { x0: number; y0: number; x1: number; y1: number };
export const RIVER_WIDTH: number;
export const BANK: number;
export const RIVER: [number, number][];
export function paintWater(mask: string[][], river?: [number, number][]): string[][];
export function writeWater(root?: string): string[][];
