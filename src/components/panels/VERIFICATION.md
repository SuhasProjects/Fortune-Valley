# Verification — centered financial panels

Scope: only src/components/panels/ changed since dc830aa. No API key, AI route, engine, store, root app, or root stylesheet changes.

## Passed checks

- npm.cmd run typecheck.
- npm.cmd test: 61 tests across 6 files (17 owned panel tests).
- npm.cmd run build.
- npm.cmd exec playwright -- test --config src/components/panels/playwright.config.ts: four checks across desktop 1366x768 and mobile 390x844.

Browser checks confirm that the actual financial dialog is horizontally and vertically centered, is wider than 700px on desktop, and stays within the phone viewport. Help starts closed; clicking ? opens it, Escape closes only help and returns focus, and a second Escape closes the host modal. Existing stress coverage still renders all 40 panel/state combinations without NaN/undefined text or runtime errors and verifies canonical Save actions.

Screenshots reviewed: desktop-centered-bank.png, mobile-centered-bank.png, and mobile-bank-help.png. A low-contrast hover on ? was found and corrected; final screenshots are regenerated after the fix. Stepped parchment edges, concise controls, and collapsed details are visible in the captures.

The change is presentation-only. Existing preview/pay-summary dependencies remain documented in MISSING.md; no numbers were invented to fill those gaps.
