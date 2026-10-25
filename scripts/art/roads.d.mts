// Types for roads.mjs (consumed by tests/art/roads.test.ts). Owner: Agent 1.
export const MASK_PATH: string;
export const PLAZA: { x: number; y: number; r: number; stone: number };
export interface Road { id: string; width: number; points: [number, number][] }
export const ROADS: Road[];
export function paintRoads(mask: string[][], roads?: Road[]): string[][];
export function writeRoads(root?: string): string[][];
