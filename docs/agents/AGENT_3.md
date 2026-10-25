# Agent 3: the building windows

Read [README.md](README.md) first (vision, palette, `--px` scale system, materials, contracts, ownership).
Branch: `agent3-windows`.

**Plain English:** when the player clicks a building, a window opens. You own those five windows (Pine Bank, Town
Office, Health House, Your Home, Market Hall) and the event cards that show up inside them. All the money logic in them
already works and is well tested; **your job is to make them feel like part of the game world instead of a web form**:
a wood-framed window with the building's picture and name plate, a little shopkeeper who greets you, clean parchment
sections, wooden buttons and sliders, without changing a single number or breaking a test.

---

## 0. What exists now (so you don't need to read it)

**Mounting today.** `src/App.tsx` (Agent 4) renders, when `store.openBuildingId` is set:
`<PanelHost building={id} onClose={store.closeBuilding}>{events…}{<ConnectedBuildingPanel building={id}/>}</PanelHost>`,
where `events` = `game.activeEvents.filter(e => e.buildingTarget === id && !(id === 'office' && e.type === 'B'))` each
rendered as `<EventCard event onChoose={optionId => store.dispatchAction({type:'apply_event_option', eventId, optionId})}/>`.
Office job offers (Type B with an `offer_job` option) are handled inside OfficePanel itself, hence the exclusion.

**Files (all yours):**
- `src/components/town/PanelHost.tsx`: native `<dialog>` modal (showModal, Tab trap, Escape via onCancel, outside-click
  close, focus restore, body-scroll lock). Header shows `buildings[id].hint` as eyebrow and `buildings[id].title` as `<h2>`
  (dialog accessible name = "Pine Bank" etc.); close button `aria-label="Close panel"`.
- `src/components/panels/ConnectedBuildingPanel.tsx`: reads `game` + `dispatchAction` from the store, renders `BuildingPanel`.
- `panelRegistry.tsx`: `bank→BankPanel, market→MarketPanel, hospital→InsurancePanel, home→HomePanel, office→OfficePanel`.
  `panelTypes.ts`: `PanelProps { state: GameState; dispatch: PanelDispatch }`.
- `PanelShell.tsx`: layout with props `{ title, status, decision, consequence, details?, help? }` →
  `<section class="ft-sheet" aria-label={title}>`, header `<h2>{title}</h2>` + `?` help toggle (`aria-label="Help for {title}"`,
  popover `role="dialog"` named `{title} help`, close button `Close help`, Escape and outside-click close, focus returns),
  then three `<section>`s labelled `Current status` / `Decision` / `Projected consequence` each with a visually hidden
  `<h3>` (`Current status`, **`Your decision`**, `Projected consequence`), optional `<details>` "History & details",
  footer "Fictional simulation · Illustrative assumptions · USD". Titles are `Bank`, `Office`, `Home`, `Insurance`, `Market`.
- `canonical/shared.tsx`: `money()`, `percent()`, `editable(state)`, `amountError(raw,min,max,step)`, `useDraft(saved)`,
  `useAction(dispatch)` → `{ send(action), pending, feedback }` (feedback shows `Saved.` or the engine error),
  `MoneyInput({label, raw, onChange, min?, max, step?, disabled?})` (input `aria-label="{label} (USD)"`), `LedgerHistory`.
- `canonical/BankPanel.tsx`: status Cash/Savings/Net worth + Debts list; decision: `Monthly savings contribution` MoneyInput +
  `Save savings contribution` → `set_contributions`; `<details>` "Extra debt payment": debt `<select>`, `One-time debt payment`
  MoneyInput, `PaymentPreview`, `Pay once` → `make_extra_payment`. Consequence: `PolicyPreview` compact.
- `canonical/OfficePanel.tsx`: status from `selectPaySummary(state)` (gross/tax/take-home per month); decision: job offers
  with `Accept offer` / `Decline offer` (`apply_event_option`), else "No offers right now."; details: yearly gross, income
  and payroll tax.
- `canonical/HomePanel.tsx`: status Housing/Essentials/Budget; decision: range slider `aria-label="Monthly discretionary budget (USD)"`
  + `<output>` + `Save budget` → `set_budget`; consequence: PolicyPreview with `household` override.
- `canonical/InsurancePanel.tsx`: current health plan (+ auto plan when the life has a car); decision: two health plans
  in a radio table "You pay on $5k" via `settleClaim`; `Save health plan` → `set_insurance` (line `health`); below it an
  **Auto insurance** form with three cards (Liability only / Full coverage / No cover) showing premium, deductible,
  "You pay on a $6k repair" and a one-line "what it covers"; `Save auto plan` → `set_insurance` (line `auto`,
  `planId` or `null`). Both go through the engine's normal policy log, so the ending's what-if can flip them
  (`whatIf.ts` `replacementsFor` gives "Keep X" / other plans; `hypotheticals` adds "Insure the car differently").
  Consequence: PolicyPreview with an `insurance` override that carries both drafts.
  **Car rule** (`hasCar` in `src/engine/events.ts`): a life has a car iff `state.debts` holds an `auto_loan` debt,
  paid off or not (debts stay in the list after payoff, only overdrafts are dropped). Car-less lives (College Student)
  never see the auto section, and `rollShocks` skips the auto shock for them after consuming its two draws, so every
  other shock lands on the same month regardless. Window subtitle (`landmarks.ts` hint): "Health & auto insurance".
- `canonical/MarketPanel.tsx`: status holdings; decision: three % inputs in `role="group"` named `Stocks allocation`,
  `Bonds allocation`, `Equity ETF allocation`, each showing `Last month · x%` and `Annual assumption · …`; total line;
  `Save allocation` → `set_allocation` (validated by engine `validateAllocation`); `<details>` "Monthly investing" with
  `Monthly investment contribution` + `Save investment contribution`.
- `PolicyPreview.tsx` (`previewHorizon(state, overrides, 12)`; compact `aside` named `12-month policy preview` showing
  "After 12 months · cash …"; full `12-month preview details` table) and `PaymentPreview.tsx` (`applyAction` + `previewMonth`).
- `scroll-panel.css` (117 lines): the current parchment skin, scoped with `.panel-dialog:has(.ft-sheet)`. Replace with kit usage.
- `src/components/flow/EventCard.tsx` (now yours): tag `WHAT HAPPENED` (Type A) / `OFFLINE OPPORTUNITY` / `NEW OPPORTUNITY`,
  title, body, learningNote, option buttons (label, `title=description`), disclaimer.
- Dev stress route: `src/components/panels/vite.config.ts` serves `/dev/stress-states` (`dev/StressStatesPage.tsx`,
  `stressFixtures.ts`): 8 fixtures × 5 panels, each in a `region` named by fixture title, panels as regions `Bank` … `Office`.
- **Tests (yours, keep green):** `canonical/panels.test.tsx` (22 jsdom tests: registry ids and three zones, no NaN/undefined
  across lives, Bank drafts/caps/payment, Market 100% rule and separate contributions, Insurance two choices, Home slider
  bounds, Office read-only and offers, stress page, help popup focus, engine-owned previews) and `panels.browser.ts` (stress
  route with its own `playwright.config.ts` on port 5174, writing screenshots into `src/components/panels/screenshots/`).
  The root `tests/town.browser.ts` (Agent 4) also opens each building, expects the dialog by full name, `Your decision` text
  after Tab, Market's `Stocks allocation` group containing `Last month` and `Annual assumption`, and Bank savings save/persist.

**Hard rules:** no financial math in UI (every number from `@/engine` or `state`; formatting only). Keep every
accessible name above. Keep `PanelProps`, the registry and the action types unchanged. Don't touch store or engine.

---

## 1. Phase 0 (first ~45 min): stub PR

`[agent3] contracts: BuildingWindow`: add `src/components/panels/BuildingWindow.tsx` exporting
`BuildingWindow({ building, onClose })` that, for now, returns today's `PanelHost` + event cards + `ConnectedBuildingPanel`
(move the event-filter logic from App into it). Agent 4 will mount `<BuildingWindow/>` instead of composing it in App.
Export it from `src/components/panels/index.ts`.

---

## 2. The window (`BuildingWindow`)

- Built on Agent 2's `Modal` (`src/ui`): `title` = full building title (`Pine Bank` …) so the dialog name stays the same;
  `plaque` = `BuildingPortrait` (Agent 1, `src/game/art`), `headerExtra` = the help `?` toggle; width `lg`. Once this works,
  reduce `PanelHost.tsx` to a thin wrapper over `Modal` (or delete it when nothing imports it).
- A **header band** in the building's roof colour (Bank `--c-roof-blue`, Office `--c-roof-teal`, Health House
  `--c-roof-red`, Home `--c-roof-red`, Market `--c-roof-green`, using the dark tone for the bottom edge) behind the plaque.
  The hint (`Savings & debt` …) sits under the title in VT323.
- **Keeper greeting:** a 24×24 pixel portrait of the building's keeper (banker with visor, town clerk with spectacles,
  nurse, you at home with a cat, market merchant with apron), drawn as text grids in `art-src/windows/keepers/*.txt`
  (palette and rules in README §4–6; 2-frame blink). Next to it, one short speech-bubble line chosen from a small static list
  per building, picked by `monthIndex % n` (e.g. Bank: "A little set aside each month becomes a cushion."). Static text only,
  never computed advice, and no numbers. Keep each line under 70 characters.
- **Pending events** for this building render first, as a pinned **notice card** (§4).
- Body sections (three Agent 2 `Inset`s), titled visibly in Pixelify: **Now** (status), **Your decision** (decision),
  **What happens next** (consequence). Keep the hidden `<h3>`s so the existing names still exist (make the visible titles
  the `<h3>`s with the same text where they match; `Your decision` must remain findable as text).
- Layout at 1440×900: status as a compact two-column ledger at the top; decision and consequence side by side
  (decision ~60%), stacking when the window is narrower than ~180 art px. History & details stays a collapsible section at the
  bottom, styled as a ledger page (ruled `P` lines, VT323).
- The `?` help popover becomes a small parchment note with a pin, same behaviour and names.
- Opening plays Agent 4's `sfx('open')`, closing `sfx('close')` (guard if the stub returns nothing).

---

## 3. Controls inside the panels

Replace raw inputs/buttons with Agent 2's kit, **keeping labels, `aria-label`s, ids, `disabled` logic and form
submission exactly as they are** (tests target them):
- `MoneyInput` → wrap the kit's `NumberField` (forward `aria-label`, `aria-invalid`, `aria-describedby`); `$` prefix.
- Submit buttons → kit `Button` `variant="primary"` for the main save; secondary actions `wood`.
- Bank debt `<select>` → kit `Select`. Home budget range → kit `Slider` (keep `aria-label`, min/max/step, and the
  `<output>`). Market % inputs → `NumberField`s in a three-column ledger with a little coloured asset chip each (stock
  `--c-roof-red`, bond `--c-roof-blue`, ETF `--c-roof-green`) and the total shown as a **stacked pixel bar** of the three
  typed percentages (display of the user's own inputs, not a projection).
- Insurance plan table → two selectable **plan cards** side by side (radio inputs stay, visually hidden, keeping their
  `aria-label`s), showing Per month, Deductible and "You pay on a $5k bill" (from `settleClaim`), with a gold outline on
  the selected card.
- Office offers → a parchment **job letter** with the title and salary and `Accept offer` / `Decline offer` buttons.
- `useAction` feedback `Saved.` → a small green stamp-style `Tag` that appears for 2 s (keep the text `Saved.`).
  Errors use the kit's error style.
- `PolicyPreview` compact → a small ledger card: "After 12 months · cash **$X**" plus the borrowing line, with a tiny
  12-step pixel bar chart of `result.withChange[i].cash` (engine values, display only; no math beyond scaling bar
  heights for display). Full preview table → kit-styled ledger table.
- `PaymentPreview` → same ledger-card style.

---

## 4. Event cards (`src/components/flow/EventCard.tsx`)

- Notice pinned to a cork/wood strip: `Tag` (`WHAT HAPPENED` red tone for Type A, `NEW OPPORTUNITY` gold, `OFFLINE
  OPPORTUNITY` dark), title in Pixelify, body in VT323, `learningNote` in italics with a small book icon, option buttons as
  kit `Button`s with `description` shown as a `Tooltip` *and* as small text under each button (keyboard users can't hover).
- Keep the disclaimer line, smaller. Keep `aria-labelledby` naming.
- Type A shocks: if `event.shock` exists, show its gross cost / insurer paid / out-of-pocket values (engine numbers) as a
  three-line receipt.

---

## 5. Stress route and tests

- Keep `/dev/stress-states` working with the new look (wrap the page in a `Board` and set `--px: 4px` so it renders
  like the game). It's your visual QA tool for all 40 states.
- Update `panels.test.tsx` and `panels.browser.ts` **only** where markup legitimately changed; never delete coverage.
  Add tests: `BuildingWindow` names the dialog by full title, shows that building's events and not others', excludes office
  Type B duplicates, keeper line is static text, Saved stamp still reads `Saved.`.
- If you change anything `tests/town.browser.ts` relies on (see §0), tell Agent 4 in your PR. Don't edit that file.
- You may commit `src/components/panels/screenshots/*` from a passing run.

---

## 6. Done checklist

- [ ] All five windows use only `src/ui` components, palette variables and the two fonts. `scroll-panel.css` is gone or
      contains only layout (grid/flex), with no colours, borders or fonts.
- [ ] Each window has the portrait, roof-colour band, keeper greeting, three clear sections, styled controls.
- [ ] Event cards look like pinned notices; Type A receipts show engine numbers.
- [ ] Every existing test still passes unchanged in meaning; new tests added; no NaN/undefined on the stress route.
- [ ] At 1366×768 and 1440×900 every window fits without page scroll (internal scroll only), and is fully keyboard-usable.
