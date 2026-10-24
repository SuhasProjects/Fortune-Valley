# Agent 3 — Building panels on the shared kit

Branch name: `agent3-panels-kit`. The five panels work and are tested; this pass is skin and polish, not behaviour.

## What you own
`src/components/panels/**` and `src/components/town/PanelHost.tsx`.

You do not touch: engine, store, flow components, `App.tsx`, the kit internals (ask Agent 2 for changes), landing, reveal.

## Context you need

- Entry point: `src/components/panels/ConnectedBuildingPanel.tsx` subscribes to the store and renders
  `BuildingPanel { building, state, dispatch }` from `panelRegistry.tsx`. Registry maps `bank`, `market`, `hospital`
  (Health House), `home`, `office` to the components in `src/components/panels/canonical/`. Props type in `panelTypes.ts`:
  `PanelProps { state: GameState; dispatch: PanelDispatch }`.
- `PanelShell.tsx` is the shared frame: `{ title, status, decision, consequence, details?, help? }` with a corner `?` help
  popover (Escape closes help before the dialog; focus returns to the trigger). Its styles are in `scroll-panel.css`
  (parchment, torn edges, centered). That CSS is what you are replacing with the kit.
- `PanelHost.tsx` (you own it now) is the native `<dialog>` host used for panels, timeline, history and the reveal:
  `{ building?, title?, onClose, children }`. It handles `showModal`, Tab containment, Escape, outside click, focus return,
  body scroll lock. Dialog is max 620 px wide today. It renders a header with eyebrow (`buildings[id].hint`) and title.
- Engine helpers the panels already use and must keep using: `previewHorizon(state, { policy?, household?, insurance? }, 12)`,
  `previewMonth`, `applyAction` on a cloned state for the one-time payment preview, `selectPaySummary(state)` (Office),
  `settleClaim(cost, plan)` (Insurance), `validateAllocation` (Market), `state.marketState.lastMonthlyReturns`,
  `state.assumptions.assets`. Actions dispatched: `set_contributions`, `set_extra_debt_payment`, `make_extra_payment`,
  `transfer`, `set_min_cash_buffer`, `set_allocation`, `set_budget`, `set_housing`, `set_insurance`, `apply_event_option`.
- Tests: `src/components/panels/canonical/panels.test.tsx` (Vitest, checks engine values, draft behaviour, immutability,
  help behaviour) and `src/components/panels/panels.browser.ts` (own Playwright config `src/components/panels/playwright.config.ts`,
  stress page at `/dev/stress-states` via `src/components/panels/vite.config.ts`). Root browser test `tests/town.browser.ts`
  opens every dialog by name (`Pine Bank`, `Town Office`, `Health House`, `Your Home`, `Market Hall`), expects the text
  `Your decision` inside, and for Market expects `Last month` and `Annual assumption` inside the group named
  `Stocks allocation`. Keep those strings or update the test in the same commit.
- Kit (from Agent 2, `@/components/layout/ui`): `PixelPanel`, `PixelButton`, `PixelInput`, `PixelSelect`, `PixelSlider`,
  `PixelToast`, `PixelTag`, `PixelDialogFrame`. Props are in `docs/agents/AGENT_2.md` and `docs/TOWN_HANDOFF.md`. Until the
  kit PR merges, keep working against those prop names with a local shim file `src/components/panels/kitShim.tsx` that you
  delete when the real kit lands.
- Visual target: `docs/art-reference/ART_DIRECTION.md` section 4 "Building panels": centered panel 720 px wide, wood header
  strip with the building name and `?`, parchment body, decision controls in a bordered inset, projected consequences in a
  second inset, VT323 numbers with `tabular-nums`.

## Tasks, in order

### 1. PanelHost on the kit (first PR, small)
- Render the dialog chrome with `PixelDialogFrame` (`width="lg"` for building panels, `"full"` when `title === 'Your next chapter'`
  so Agent 5's reveal gets 94 vw). Keep all dialog behaviour and the `aria-labelledby` wiring; keep the `Close panel` button
  label (tests use it). Remove the old `.panel-dialog` styling from your side; `world.css` cleanup is Agent 4's and they know.
- Eyebrow text stays (`Savings & debt`, `Income & career`, `Hospital / Insurance`, `Rent & everyday costs`,
  `Investments & allocation`).

### 2. PanelShell on the kit
- Replace `scroll-panel.css` classes with kit components: status zone as a `PixelPanel variant="parchment" padding="sm"`
  with a label/value grid; decision zone as a bordered inset; consequence zone as a second inset with a `PixelTag` for
  good/bad deltas; help popover as `PixelPanel variant="scroll"`.
- Keep the help popover semantics exactly (`aria-expanded`, `aria-controls`, Escape order, focus return). Tests cover them.
- Delete `scroll-panel.css` once nothing imports it.

### 3. Controls in each panel
- Bank: savings contribution and extra debt payment as `PixelSlider` with `format={usd}`; one-time payment as `PixelInput
  type="number" prefix="$"`; Save as `PixelButton variant="primary"`.
- Market: three allocation `PixelInput`s with `suffix="%"`, inline `error` from `validateAllocation`; contribution slider;
  returns and assumptions as a compact table with `tabular-nums`.
- Insurance: two plan cards as `PixelPanel`s with a radio each (`PixelSelect` is wrong here; use native radios styled by a
  small class in your folder); the $5,000 claim comparison as a two-column table.
- Home: discretionary `PixelSlider` within engine bounds; housing read-only rows.
- Office: pay summary table; job offer event actions use `PixelButton`s (Accept primary, Decline default).
- Every dollar display goes through `usd` from `src/components/flow/format.ts`; never format money yourself.

### 4. Consequence and preview copy
- Compact preview line pattern: `After 12 months: cash $X (↑/↓ $Y vs now)`; shortfall warning as `PixelTag tone="bad"`:
  `Runs short in month N`. Full current-vs-draft table lives in help.
- Keep the disclaimer footer: `Fictional simulation · Illustrative assumptions · USD`.

### 5. Tests and screenshots
- Update `panels.test.tsx` selectors for the new markup; keep every assertion about values and immutability.
- Update `panels.browser.ts` and, only for strings you changed, `tests/town.browser.ts`.
- Regenerate `src/components/panels/screenshots/` and, after a full passing root run, `docs/screenshots/*-panel.png`.

## Rules
- No new financial calculations. If a value you want is not available from the engine or the state, ask Agent 1.
- Do not change panel behaviour: drafts only commit on Save; previews never dispatch.
- Keep each panel under 250 lines; shared bits go in `canonical/shared.tsx`.

## Acceptance
- All five dialogs render on the kit at 1440×900 with no horizontal scroll and no text under 16 px.
- `npm test` and both Playwright suites green; `panels.test.tsx` still asserts engine values.
- `scroll-panel.css` and `kitShim.tsx` deleted; no other agent's files changed except the test lines you needed.
