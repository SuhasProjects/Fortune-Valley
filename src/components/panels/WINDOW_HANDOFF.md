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
now uses Agent 1's real world sprites. Headers choose a smaller whole-number zoom
for these large building sprites; no fractional scaling is used. The window header
also resets the world renderer's conflicting global fv-plaque positioning so the
kit's name plaque stays in flow. Agent 1 can later scope its world plaque selector.

Kit compatibility notes for Agent 2: NumberField currently discards empty drafts
and string editing states, so money/allocation inputs use the kit's Field with
native number props. Slider currently drops disabled/aria-label/aria-invalid and
aria-describedby props; Home keeps its native range with the shared fv-slider
material until those props can be forwarded. No local control material is drawn.

Validation on the real-world base: typecheck, production build and all 190 unit tests pass. All six
owned browser checks pass (two laptop-only cases are intentionally skipped in the
mobile project): all five windows at 1366x768 and 1440x900, both stress routes and
desktop/mobile Bank help/focus. The mobile opener uses keyboard activation so the
panel suite stays independent of the shared town's pointer overlays.

Shared root smoke failures to coordinate (not changed here):
- Agent 2: mobile gallery controls intercept pointer clicks at scales 4 and 6.
- Agent 4: the mobile coach tip intercepts town building clicks.
- Agent 4/5: the town test expects a `Your next chapter` dialog, while the new
  finish flow no longer renders that dialog immediately.

The final root smoke run has 23 passing, four failing and three skipped checks.
No other agent's tests were edited. PR: https://github.com/SuhasProjects/financegamething/pull/12
