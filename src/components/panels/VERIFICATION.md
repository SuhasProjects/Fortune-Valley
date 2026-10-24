# Verification — October 24, 2026

## Shared app integration

Base: main commit a67f79b, fetched from GitHub; local working branch agent3-panels.

From repository root:

- npm.cmd run typecheck: passed.
- npm.cmd test: passed, 23 tests across 3 files.
- npm.cmd run build: passed. Vite emits upstream Framer Motion use-client directive warnings; bundle output succeeds.

Panel tests cover all 20 fixture render combinations and all 20 real shared-scenario/building combinations, draft-only edits, pending locks, rejection feedback, event-ID resolution, store persistence, invalid batch rejection with no dispatch, next-month savings, and unavailable engine actions.

## Browser smoke checks

Edge at http://127.0.0.1:5173/:

1. Launched the shared Entry-Level Worker scenario.
2. Opened Pine Bank and saw actual store cash ($1,800), savings ($2,200), net worth (-$4,600), debt ($9,200), and saved contribution ($250/month).
3. Changed savings contribution to $300, saved, and received Policy saved feedback.
4. Closed the panel and advanced one month using the shared clock.
5. Reopened Bank: contribution remained $300/month; savings rose to $2,500; debt/cash/net worth reflected the shared engine update.
6. Unsupported extra debt payment controls were disabled with a visible explanation.

Earlier fixture-workshop browser checks also verified investment total validation (110% disables Save, 100% enables it), Home navigation to Insurance, and fixture plan selection persistence. These fixture checks do not prove actual insurance engine functionality.

## Visual and engine limitations

Earlier screenshot capture failed twice with Page.captureScreenshot timeouts; no screenshots were produced or visually inspected. A requested 390px viewport override did not apply (measured viewport stayed 1028px); it was reset. Mobile visual QA remains unverified.

The fetched runtime is explicitly temporary: investment contributions currently all enter ETF despite saved target allocation; investment returns, debt interest, claims, extra payments, insurance changes, and discretionary budgets are not implemented. Panels expose these limitations and disable unsupported controls. Office has no forward tax/pay selectors, so absent estimates remain unavailable. Insurance coverage is displayed as the recorded fraction, not an invented dollar limit.

The shared town dialog still needs Agent 2's full focus management and Escape handling. Its accessible title and close-button label were added during panel integration.
