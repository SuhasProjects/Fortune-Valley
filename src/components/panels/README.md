# Financial Town panels — Agent 3 handoff

Integrated against shared commit `a67f79b` (main's merge of agent4-flow) on local branch `agent3-panels`. The user authorized the small App.tsx integration; all other source changes are within src/components/panels/.

## Run

From the repository root:

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The actual game now mounts ConnectedBuildingPanel inside the existing building dialog. For the isolated, explicitly labeled fixture workshop, run `npm.cmd exec vite -- src/components/panels --host 127.0.0.1 --port 5174` from the root. Use the root dependency installation only, avoiding duplicate React copies. The workshop has no financial engine or live AI; it demonstrates draft/save behavior and rejects fixture transactions/event resolution rather than faking effects.

## Public components

`index.ts` exports BuildingPanel, panelRegistry, the five named panels, and presentation types. Import ConnectedBuildingPanel from its own module to use the shared store. Keeping that connector out of index.ts keeps the pure panels and fixture workshop independent of Zustand and the engine.

```tsx
<ConnectedBuildingPanel building={store.openBuildingId} />
```

ConnectedBuildingPanel maps the shared hospital building key to the presentation insurance key. The canonical GameState/GameAction definitions are imported from src/types/domain.ts. PanelModel is a presentation adapter, not an alternate GameState. Numerical balances, net worth, policy values, debt fields, and insurance details come from shared state/selectors. No financial calculator is implemented inside the panels.

## Actions and present engine limitations

- Savings: uses set_contributions, preserving the investment contribution. The next month uses the shared engine's actual savings logic.
- Market: preflights allocation plus contribution through applyActionPure before synchronously dispatching either action; preserves the savings policy. Invalid batches dispatch nothing. The current engine saves allocation but sends all investment contributions to ETF and does not apply returns. This limitation is visible in the panel.
- Events: commands contain event ID and option ID. The connector resolves the current canonical option and sends its engine-owned action. Missing, stale, or expired events reject. It does not manually assign salary.
- Debt extra payments, discretionary budgets, and insurance changes are not implemented by the shared runtime. Those controls are disabled or unavailable, and command calls reject with an explanation. Implement their canonical engine actions before enabling them.
- Current InsurancePlan has no coverage category, dollar cap, exclusions, or selectable catalog. Current plans are shown read-only with the actual recorded coverage fraction; it is never misrepresented as a dollar limit. No category is inferred from a plan ID.
- No monthly pay/tax selectors exist. Office uses recorded income/tax ledger entries when available and labels unavailable figures explicitly. Take-home estimate remains unavailable; the UI does not invent tax arithmetic. Per-asset annual return/volatility assumptions are also unavailable.
- Money-field min/max/step settings are numeric presentation guards, not engine affordability limits. The engine must remain authoritative.

`planPanelCommand` and `dispatchPanelCommand` return clear engine rejection feedback. Inputs remain drafts until Save. Async command failures and pending submission locks are supported by the pure panels. History is read from immutable ledger rows and displayed newest first.

## Overlay boundary and visual design

The existing App.tsx dialog now has an accessible name and named close button. Agent 2 still owns focus trapping, Escape dismissal, initial focus, restoration, and scroll-shell polish; these are not fully implemented in the fetched shell. Panel contents use explicit labels, 44px controls, focus outlines, live feedback, table headers, and collapsible history.

Scoped panels.css provides a local 4px grid, square borders, offset shadows, warm parchment, forest green, and monospace type. No external asset or font requests are introduced. Import panels.css explicitly when using individual named panels without the registry.

## Verification

See VERIFICATION.md. Root typecheck/build and 23 tests pass, including all four shared scenarios, store policy persistence, next-month savings, invalid market batches, and unsupported action rejection. Actual allocation-dependent returns, claims, debt interest, and insurance changes still need the canonical engine. No AI server or Monte Carlo implementation was added.
