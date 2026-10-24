# Reduced panel verification — October 24, 2026

## Scope check

All source changes since 39c01ff are in src/components/panels/. Canonical domain, engine, store, AI, App.tsx, root Vite config, and root tests were not modified. Old custom CSS and alternate PanelModel/PanelCommand contracts were removed.

## Executed checks

- npm.cmd run typecheck: passed.
- npm.cmd test: 59 passed across 6 files. Fifteen reduced panel tests replace the previous larger-scope panel suite.
- npm.cmd run build: passed.
- npm.cmd exec playwright -- test --config src/components/panels/playwright.config.ts: desktop 1366x768 and mobile 390x844 passed.

The tests cover canonical registry keys/props, the three PanelShell zones, all panels for four profiles, finite/range/step validation, cash-and-debt input bounds, local drafts, separate allocation/contribution actions, rejected actions preserving state, two-choice health insurance, one budget slider, read-only Office/job option IDs, and all 40 stress panels without NaN/undefined text. Browser checks use the exact /dev/stress-states route and apply saved savings, insurance, and budget changes through the real engine.

## Visual status and limitations

The screenshot pair in screenshots/ was inspected. It intentionally shows plain semantic HTML because the shared React pixel kit is absent; no replacement styles were created. Kit visual acceptance remains blocked. The live 12-month preview and complete monthly net-pay summary are explicitly unavailable, not calculated or faked. Details and ownership requests are in MISSING.md.

The root town smoke tests use previous form labels and were not edited or claimed to pass under the new UI contract. The folder-owned browser suite verifies the requested reduced interface and dev route directly.
