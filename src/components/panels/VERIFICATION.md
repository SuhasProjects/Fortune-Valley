# Verification — October 24, 2026

## Shared-repository checkpoint

The completed Bank UX was published as 3f4e94f to both SuhasProjects/financegamething:agent3-panels and the user's fork. Subsequently merged shared-main e50a76f (including the explanation-enabled store) and frontendpixelart 9cd321c (illustrated backdrop and multi-building badges), retaining ConnectedBuildingPanel as the default content.

This integrated version passes typecheck, production build, 69 unit/integration tests, and all four root desktop/mobile browser checks. Full-town screenshots were regenerated. The Bank-specific browser suite also passed its two viewport projects in the preceding UX checkpoint. No force pushes or shared-main rewrites were used.

## Latest Bank UX verification

- Pulled archetype tuning 7879fb3 from upstream/main.
- Typecheck and production build pass; 68 tests across 8 files pass.
- Two focused Bank browser tests pass at desktop 1366x768 and mobile 390x844: transfers, cleared one-time fields, saved recurring debt payment/cash buffer, next-month persistence, over-limit inputs, and runtime error checks.
- Added seven UI regressions covering empty payment fields, engine-backed transfers without a net-worth change, insufficient funds, recurring debt/buffer actions, no-funds controls, no-coverage household copy, and accurate withholding labels.
- Bank screenshots are captured in the sibling screenshots/ directory. These are separate from the earlier full-town screenshots below.

The panel edits are confined to src/components/panels/. No engine, schema, store, AI, town, or root app source was modified in this UX pass.

Integrated upstream/main 8fbcb06 (canonical engine/AI gateway, hardened Agent 4 flow, and Agent 2 valley theme dd020ef) into agent3-panels.

## Commands

- npm.cmd run typecheck — passed, app and Node/server configuration.
- npm.cmd test — passed, 61 tests across 7 files.
- npm.cmd run build — passed, production Vite bundle.
- npm.cmd run test:browser — passed, 4 tests across desktop 1366x768 and mobile 390x844.

The merged package lock preserves the canonical dependency ranges and adds the existing UI/browser test dependencies. Vite needed permission to read parent directories outside this environment's filesystem sandbox. The missing Playwright Chromium headless shell was installed using the official package's install command.

## Financial integration checks

All five panels render for all four shared archetypes and all four labeled workshop fixtures. Tests exercise recurring savings transfers over two months, preserved companion contributions, allocation-dependent investment paths under the same seed, invalid market batch rejection without partial dispatch, actual cash/debt reduction, repayment capped at debt balance, insufficient-funds rejection, recurring budget ledger entries, engine-bounded validation, engine-derived pay estimates, and canonical event resolution with replayable effects.

Insurance checks use a deterministic medical-cost fixture exceeding the deductible. A policy change does not refund/debit historical premiums; next-month premiums reflect the chosen plan. Insured and uninsured runs sample identical shock kinds and gross costs under the same seed, while insured out-of-pocket cost is lower. An initial test fixture fell below the deductible, correctly producing no insurer payment; the fixture was corrected rather than changing the engine.

## Browser checks and visual inspection

Both viewport projects verify all five keyboard-activated building buttons, dialog Tab containment/Escape/focus return/backdrop close, month controls, pause/resume, event badges, notification history, finish/reset, overflow, and no runtime errors. Both also save savings, investment allocation/contribution, and insurance policies through actual UI controls, advance a month, and confirm persistence after reopening buildings.

Updated landing/town/panel screenshots are in docs/screenshots/. The desktop and mobile panel screenshots were visually inspected; the parchment content fits the responsive native dialog and its controls remain accessible through internal scrolling. This supersedes the earlier fixture-only screenshot/mobile verification limitation.

## Remaining scope

Live AI credentials were not tested; fallback remains available. Agent 5's chart/reveal module is not present in the fetched branches, so the app retains an accurate plain-text computed Monte Carlo reveal and its renderReveal hook. Cross-browser testing beyond Chromium is not covered.
