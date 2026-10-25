/**
 * One-slot save file with schema version. Pure (de)serialization + validation;
 * the store decides when to call it and where to store the string. Owner: Agent 1.
 */
import type { GameConfig, GameState } from '@/types/domain';
import { netWorthOf } from './accounting';
import { validateAllocation, validateAssumptions, validateConfig } from './validation';

export const SAVE_SCHEMA_VERSION = 1 as const;
export const SAVE_STORAGE_KEY = 'financial-town:save:v1';

export interface SaveFile {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  savedAt: string;
  config: GameConfig;
  state: GameState;
}

export type ParsedSave = { ok: true; save: SaveFile } | { ok: false; error: string };

export function serializeSave(config: GameConfig, state: GameState): string {
  const save: SaveFile = { schemaVersion: SAVE_SCHEMA_VERSION, savedAt: new Date().toISOString(), config, state };
  return JSON.stringify(save);
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Parses and validates a save string; never throws. Rejects other schema versions and inconsistent states. */
export function parseSave(raw: string | null | undefined): ParsedSave {
  if (!raw) return { ok: false, error: 'No save data' };
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return { ok: false, error: 'Save data is not valid JSON' }; }
  if (!json || typeof json !== 'object') return { ok: false, error: 'Save data malformed' };
  const save = json as Partial<SaveFile>;
  if (save.schemaVersion !== SAVE_SCHEMA_VERSION) return { ok: false, error: `Unsupported save schema ${String(save.schemaVersion)}` };
  if (!save.config || !save.state) return { ok: false, error: 'Save is missing config or state' };
  try {
    const cv = validateConfig(save.config);
    if (!cv.ok) return { ok: false, error: `Saved config invalid: ${cv.message}` };
    const s = save.state;
    if (s.schemaVersion !== 1) return { ok: false, error: 'Unsupported state schema' };
    if (s.scenarioId !== save.config.scenarioId || s.seed !== save.config.seed) return { ok: false, error: 'Saved state does not belong to its config' };
    if (!Number.isInteger(s.monthIndex) || s.monthIndex < 0 || s.monthIndex > save.config.durationMonths) return { ok: false, error: 'Saved month out of range' };
    if (!['setup', 'playing', 'paused', 'finished'].includes(s.status)) return { ok: false, error: 'Saved status invalid' };
    if (![s.cash, s.savings, s.investments.stock, s.investments.bond, s.investments.etf].every(isNum)) return { ok: false, error: 'Saved balances invalid' };
    if (!Array.isArray(s.debts) || !s.debts.every((d) => isNum(d.balance) && d.balance >= 0 && isNum(d.apr) && typeof d.id === 'string')) return { ok: false, error: 'Saved debts invalid' };
    if (!Array.isArray(s.ledger) || !Array.isArray(s.policyLog) || !Array.isArray(s.timeline) || !Array.isArray(s.notifications) || !Array.isArray(s.activeEvents) || !Array.isArray(s.netWorthHistory) || !Array.isArray(s.shortfallMonths) || !Array.isArray(s.realizedShocks)) return { ok: false, error: 'Saved history invalid' };
    // The engine runs on the state's own copies of these; a missing or corrupt one would throw mid-month.
    const isObj = (v: unknown) => !!v && typeof v === 'object';
    if (![s.marketState, s.policy, s.household, s.employment, s.assumptions, s.insurance, s.taxProfile].every(isObj) || !isObj(s.marketState.index) || !isObj(s.marketState.lastMonthlyReturns)) return { ok: false, error: 'Saved state is missing required sections' };
    if (!Number.isInteger(s.durationMonths) || s.durationMonths < 1 || s.monthIndex > s.durationMonths) return { ok: false, error: 'Saved duration invalid' };
    if (s.lifeEvents === undefined) s.lifeEvents = []; // saves from before life events existed
    else if (!Array.isArray(s.lifeEvents) || !s.lifeEvents.every((e) => isNum(e.amountSigned) && Number.isInteger(e.monthIndex))) return { ok: false, error: 'Saved life events invalid' };
    const av = validateAssumptions(s.assumptions);
    if (!av.ok) return { ok: false, error: `Saved assumptions invalid: ${av.message}` };
    const alloc = validateAllocation(s.policy.targetAllocation);
    if (!alloc.ok) return { ok: false, error: `Saved policy invalid: ${alloc.message}` };
    if (s.netWorthHistory.length !== s.monthIndex + 1 || !s.netWorthHistory.every(isNum)) return { ok: false, error: 'Saved net-worth history inconsistent' };
    if (Math.abs((s.netWorthHistory[s.monthIndex] ?? NaN) - netWorthOf(s)) > 0.011) return { ok: false, error: 'Saved net worth does not reconcile' };
    return { ok: true, save: { schemaVersion: SAVE_SCHEMA_VERSION, savedAt: typeof save.savedAt === 'string' ? save.savedAt : '', config: save.config, state: s } };
  } catch {
    return { ok: false, error: 'Save data malformed' };
  }
}

/** Minimal storage interface so the store can be tested without a browser. */
export interface KeyValueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

export function defaultStorage(): KeyValueStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__ft_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}
