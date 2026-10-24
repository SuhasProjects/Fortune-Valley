# Fortune Valley window checkpoints

## Phase 0: public contract

`BuildingWindow({ building, onClose })` is exported from this folder's index.
Agent 4: replace the building-only PanelHost/event/ConnectedBuildingPanel composition
with this component; preserve custom panel injection if still required by App.
The window reads the store, filters building events, preserves the Office Type B
exclusion, and dispatches the original event/option IDs. App is untouched here.

The shared `src/ui` kit is not present yet, so this checkpoint uses the existing
PanelHost and financial sheets. No financial logic changed.

Validation: typecheck, 150 unit tests and 12 root browser tests pass.
