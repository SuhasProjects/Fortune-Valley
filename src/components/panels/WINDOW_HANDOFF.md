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

## Window and notice implementation

PanelHost is now a compatibility wrapper over the shared Modal. Existing App and
GameScreen callers receive the new windows without changes to their owned files.
BuildingWindow remains the preferred public entry point. Help mounts into a header
slot; all previous dialog, field, action and help names remain unchanged.

The five windows have roof bands, keeper greetings and two-frame authored keeper
sprites, ledger sections, shared-kit fields/buttons/selects, selectable health
cards, job letters, allocation chips/bar and engine-derived cash bars. EventCard
uses shared Board/Tag/Button/Tooltip and renders engine shock receipts and visible
option descriptions. Saved feedback expires after two seconds; errors persist.

Run `node art-src/windows/compile-keepers.mjs` to compile only the keeper assets
through the shared parser/palette/renderer. The integrator's next full art compile
will add these grids to the generated global manifest. The shared BuildingPortrait
is used directly; its current main implementation is still Agent 1's stub.

Kit compatibility notes for Agent 2: NumberField currently discards empty drafts
and string editing states, so money/allocation inputs use the kit's Field with
native number props. Slider currently drops disabled/aria-label/aria-invalid and
aria-describedby props; Home keeps its native range with the shared fv-slider
material until those props can be forwarded. No local control material is drawn.

Validation: typecheck, production build and all 185 unit tests pass. The owned
browser checks pass for all five windows at 1366x768 and 1440x900, both stress
routes and the desktop/mobile Bank help/focus flow. The mobile opener uses keyboard
activation because the shared HUD status currently intercepts the Bank hotspot.

Shared root smoke failures to coordinate (not changed here):
- Agent 2: mobile HUD/gallery controls intercept pointer clicks; gallery image
  readiness races at scale 4 (`img.complete` check without waiting for loading).
- Agent 4/5: the town test expects a `Your next chapter` dialog, while the new
  finish flow no longer renders that dialog immediately.
