// @vitest-environment jsdom
// OWNER: Agent 1. A /demo tab mirrors its game into sessionStorage so an accidental reload resumes it; the Continue slot
// (localStorage) is never written, and a fresh navigation to /demo starts over.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '@/stores/useGameStore';
import { demoConfig, DEMO_SESSION_KEY, DEMO_STORAGE_KEY, readDemoSession, writeDemoSession } from '@/demo/demoMode';
import { SAVE_STORAGE_KEY } from '@/engine/persistence';

beforeEach(() => {
  window.history.replaceState({}, '', '/demo');
  sessionStorage.clear();
  localStorage.clear();
  useGameStore.getState().resetGame();
});
afterEach(() => { window.history.replaceState({}, '', '/'); sessionStorage.removeItem(DEMO_STORAGE_KEY); });

describe('demo session resume', () => {
  it('mirrors every month of a demo game into sessionStorage and never into the Continue slot', () => {
    useGameStore.getState().startGame(demoConfig());
    useGameStore.getState().advanceOneMonth();
    useGameStore.getState().advanceOneMonth();
    expect(sessionStorage.getItem(DEMO_SESSION_KEY)).toContain('"monthIndex":2');
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(useGameStore.getState().saveGame()).toBe(false);
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
  });

  it('resumes the in-tab game after a reload, at the same month, with the demo config', () => {
    useGameStore.getState().startGame(demoConfig());
    useGameStore.getState().advanceOneMonth();
    useGameStore.getState().advanceOneMonth();
    useGameStore.getState().advanceOneMonth();
    const raw = sessionStorage.getItem(DEMO_SESSION_KEY)!;
    useGameStore.getState().resetGame(); // the page unloads …
    expect(sessionStorage.getItem(DEMO_SESSION_KEY)).toBeNull(); // (a real reset clears the mirror)
    writeDemoSession(raw); // … but a reload keeps what the tab had
    expect(useGameStore.getState().resumeDemoSession()).toBe(true);
    expect(useGameStore.getState().game?.monthIndex).toBe(3);
    expect(useGameStore.getState().config?.scenarioId).toBe('demo:overloaded-graduate');
    expect(useGameStore.getState().savedGame).toBeNull();
  });

  it('has nothing to resume without a mirror, and ignores it off the demo route', () => {
    expect(useGameStore.getState().resumeDemoSession()).toBe(false);
    writeDemoSession('{"schemaVersion":1}'); // unparsable save
    expect(useGameStore.getState().resumeDemoSession()).toBe(false);
    expect(readDemoSession()).toBe('{"schemaVersion":1}');
    window.history.replaceState({}, '', '/?demo=0');
    expect(useGameStore.getState().resumeDemoSession()).toBe(false);
  });
});
