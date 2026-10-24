# Verification — October 24, 2026

Integrated upstream/main c202e0a (Agent 1 canonical engine plus Agent 4 flow) and upstream/frontendpixelart f69c091 (Agent 2 town and dialog shell) into agent3-panels.

## Commands

- npm.cmd run typecheck — passed, app and Node/server configuration.
- npm.cmd test — passed, 31 tests across 5 files.
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
