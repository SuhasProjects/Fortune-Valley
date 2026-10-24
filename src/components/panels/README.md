# Fortune Valley building windows

Public integration: BuildingWindow({ building, onClose }) from this folder's index.
It reads the store, renders that building's pending events and canonical panel, and
keeps Office job offers inside OfficePanel. PanelHost remains a thin shared-Modal
wrapper for the existing GameScreen caller, so current players also see the new UI.

The five windows use the shared pixel kit, roof colours, real building portraits,
authored blinking keepers, short static greetings and three ledger sections.
All money figures and effects still come from the engine/state. Controls keep their
existing accessible names, raw drafts, disabled logic and explicit Save actions.

See WINDOW_HANDOFF.md for integration details, shared-kit API gaps and root smoke
failures owned by the HUD/flow/title agents. VERIFICATION.md records the checks.

## Preview

- npm run dev: integrated game.
- npm exec vite -- --config src/components/panels/vite.config.ts --host 127.0.0.1 --port 5174:
  integrated game plus /dev/stress-states (40 canonical panel/state combinations).
- node art-src/windows/compile-keepers.mjs: compile the five 24x24, two-frame keeper
  grids using the shared palette/parser/renderer, without rewriting another agent's
  generated manifest.

Owned screenshots live in screenshots/. The integrator owns root town screenshots.
