# Agent 5 handoff

Implemented on `agent5-title-reveal`, based on `origin/main` at `8fc6353`.

## Public components

- `TitleScreen()` starts fixed-seed premade games, generates custom stories with optional numbers, previews the result, restores saved games, and opens Guide/Options.
- `GuideWindow({ onClose })` provides five keyboard-accessible chapters.
- `RevealScreen({ payload, onPlayAgain })` shows a full-screen ledger, four straight outcome lines, a comparison section, explanation questions, assumptions, and play again.
- `OutcomeChart({ lines, yDomain, title, highlightLabel? })` renders exact engine endpoints, shared display domains, direct labels, keyboard highlighting, and accessible tables.

`Landing` and `RevealChart` are compatibility exports so today's App works without editing Agent 4's files. Agent 4 should route the new screens directly, then remove these exports and the legacy-dialog geometry rules at the bottom of `src/game/reveal/reveal.css`.

## Dependencies still absent from this checkout

1. **Agent 1:** `GameStage`, `useStageScale`, `TownWorld`, `BuildingPortrait`, shared palette and art compiler, and the documented `outcomeLines`, `listDecisions`, `runWhatIfAsync` exports.
2. **Agent 2:** `src/ui` materials and tokens. The bridge currently reuses existing `.pixel-button`, `.pixel-panel`, and `PanelHost`; it does not introduce a competing UI kit. Native input/select fields should move to `Field`, `NumberField`, and `Select` once the kit lands. Guide tabs should move to kit `Tabs`.
3. **Agent 4:** direct screen routing, full `OptionsWindow`, and `sfx`.

`contracts.tsx` discovers the exact documented component paths using Vite's eager glob imports. It uses GameStage, Button, Board, Modal, BuildingPortrait, OptionsWindow, TownWorld and click audio automatically when those modules exist. These bridges should be replaced by direct imports during integration, once the actual modules and their prop types can be checked together. The fallback stage implements the documented integer scale; the fallback Options exposes only working title/reveal reduced motion, persisted under the documented settings key.

The ending contract is mirrored in `src/game/reveal/ending-contract.ts`. When Agent 1 exports the API, its actual functions are used. Until then only existing Monte Carlo endpoints are mapped to the original chart. Comparisons truthfully show as unavailable. No monetary delta or spread is fabricated or computed by this UI. Mocked unit and browser tests exercise selectors, paired display domains, signed change tiles, aborts, and stale-response protection independently of the missing engine.

## Art

Palette-limited text grids are in `art-src/title/`, compiled PNGs/metadata in `public/art/title/`. All art is separate layers and sprites, not a full-screen raster. Sign lettering remains HTML. Portraits have blink frames. Vines/haze/sign/quill/chart animations are stepped and respect OS or saved reduced motion.

Until the shared art compiler arrives, `node art-src/title/compile.mjs` deterministically compiles only this agent's sources using Node built-ins. It emits the README text-grid format without changing Agent 1's scripts/package. Once the shared pipeline arrives, use `npm run art` and retire this interim compiler and palette fallback.

## Ownership and cleanup

The user's pre-existing edits in `.env.example`, `README.md`, `TownIllustration.tsx`, and `welcome.css` are preserved. The illustration is unused. `welcome.css` remains because it contains user edits and its import belongs to Agent 2's `src/styles/index.css`. Remove the import and retire both legacy files with their owners during final cleanup. The old fan/histogram renderer is replaced; its compatibility export remains only for the old router.

Agent 4's `AppShell.test.tsx` still clicks scenario buttons directly on the old landing screen. Its two tests must click `New Story` before choosing a life. The user explicitly requested leaving this file unchanged. No test was deleted or weakened to mask this mismatch.

Browser helpers now use the title menu and a `Simulation results` landmark. Update other browser tests only through those helpers. Browser comparison tests explicitly stub the missing ending module; they do not claim to verify Agent 1's simulation accuracy.
