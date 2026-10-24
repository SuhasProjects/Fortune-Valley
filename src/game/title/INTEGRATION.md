# Agent 5 handoff

Implemented on `agent5-title-reveal`, rebased onto the shared stage, real ending engine, and game-flow work now on `main`.

## Public components

- `TitleScreen()` starts fixed-seed premade games, generates custom stories with optional numbers, previews the result, restores saved games, and opens Guide/Options.
- `GuideWindow({ onClose })` provides five keyboard-accessible chapters.
- `RevealScreen({ payload, onPlayAgain })` shows a full-screen ledger, four straight outcome lines, a comparison section, explanation questions, assumptions, and play again.
- `OutcomeChart({ lines, yDomain, title, highlightLabel? })` renders exact engine endpoints, shared display domains, direct labels, keyboard highlighting, and accessible tables.

The title and ending use Agent 1's `GameStage`, `TownWorld`, palette, generated art manifest, and real `outcomeLines`, `listDecisions`, and `runWhatIfAsync` functions. They use Agent 4's shared `OptionsWindow` and sound effects.

`Landing` and `RevealChart` remain compatibility exports because Agent 4's current `App` still imports those names. `App` can route `TitleScreen` and `RevealScreen` directly in a follow-up, then the compatibility exports and the legacy-dialog geometry rules at the bottom of `src/game/reveal/reveal.css` can be removed.

## Remaining integration

**Agent 2:** `src/ui` materials have not landed yet. The title and reveal temporarily use the existing `.pixel-button`, `.pixel-panel`, and `PanelHost`, while Agent 2's kit is detected automatically. Native fields can move to `Field`, `NumberField`, and `Select`, and guide tabs to `Tabs`, when that kit becomes available.

**Agent 4:** the router still mounts the compatibility exports. On mobile, the building world is partly behind the HUD, so some town hotspots cannot be tapped; the keyboard shortcuts work and the browser flow test uses them at that breakpoint.

## Art

Palette-limited text grids are in `art-src/title/`, compiled PNGs/metadata in `public/art/title/`. All art is separate layers and sprites, not a full-screen raster. Sign lettering remains HTML. Portraits have blink frames. Vines/haze/sign/quill/chart animations are stepped and respect OS or saved reduced motion.

Run `npm run art` after changing a title grid. The shared compiler writes the PNGs, metadata, palette CSS, and generated sprite manifest.

## Ownership and cleanup

The user's pre-existing edits in `.env.example`, `README.md`, `TownIllustration.tsx`, and `welcome.css` are preserved outside the Agent 5 commit. The illustration is unused. `welcome.css` remains because its import belongs to Agent 2's `src/styles/index.css`. Remove the import and retire both legacy files with their owners during final cleanup. The old fan/histogram renderer is replaced; its compatibility export remains only for the current router.

`AppShell.test.tsx` now follows the title screen before choosing a life. No test was deleted or weakened to mask the title integration.

Browser helpers use the title menu, finish confirmation, and `Simulation results` landmark. Browser comparison tests stub the ending module so they test selection, shared axes, aborting, and stale-response handling independently of simulation accuracy.
