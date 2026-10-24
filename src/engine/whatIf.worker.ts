// Runs one what-if (1,000 paths) off the main thread. Owner: Agent 1.
import type { WhatIfInput } from '@/types/domain';
import { runWhatIf } from './whatIf';

const scope = self as unknown as { onmessage: ((event: MessageEvent<WhatIfInput>) => void) | null; postMessage(message: unknown): void };

scope.onmessage = (event) => {
  try {
    scope.postMessage({ ok: true, result: runWhatIf(event.data) });
  } catch (e) {
    scope.postMessage({ ok: false, message: e instanceof Error ? e.message : 'What-if failed' });
  }
};
