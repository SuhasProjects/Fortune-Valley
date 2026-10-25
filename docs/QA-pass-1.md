# QA pass 1 — `origin/agent5-integrate` (commit 08c6527 + integrate branch), 2026-10-24

Tester: QA agent, own worktree, port 5185, `/api/ai` stubbed to 503. Screenshots in `docs/qa/<step>-<WxH>.png`
(steps 01–21 at 1440×900, 1280×720, 1920×1080; `kb-*` = keyboard-only pass). Scripted with `tests/qa.browser.ts`
(not committed). Judged against `docs/agents/README.md` §2, §7, §8 and `docs/art-reference/main-screen-reference.png`.

## 1. Automated checks

| Command | Result |
|---|---|
| `npm run typecheck` | pass (exit 0) |
| `npm test` (Vitest) | **185 / 185 passed**, 24 files |
| `npm run build` | pass (1 chunk-size warning: `index-*.js` 597 kB) |
| `FV_PORT=5185 npm run test:browser` | **23 passed, 14 failed, 3 skipped** (40 total, 1.5 min) |

Environment note: with `node_modules` symlinked to the main checkout, Vite refuses to serve `@fontsource/*` files
("outside of Vite serving allow list"), every screen renders in the monospace fallback and three extra gallery tests
fail on `document.fonts` errors (first run: 21 pass / 16 fail). Counts above are from a second run with `@fontsource`
copied locally. Other agents using the symlink will see the same false failures.

Failing browser tests (first error line; cause from `test-results/*/error-context.md`):

| # | Test | First error / real cause |
|---|---|---|
| 1 | [desktop] hud: UI gallery at scale 3 | `expect(brokenImages).toEqual([])` — 24 icon PNGs (`/art/ui/icons/{warning,sound-on,sound-off,save,quill,star}-{small,16}.png`) report `naturalWidth 0` at check time. Files exist and 404-free; likely not yet decoded when read. Owner: Agent 2 (test timing / icon loading). |
| 2–4 | [desktop] reveal ×3 (`played results…`, `finishing without decisions…`, `comparison selectors…`) | `locator.click: Test timeout 30000ms` — `waiting for getByRole('button', {name:/College Student/})` …`<span> from <button.fv-story-card> subtree intercepts pointer events`. **Known**: story cards never "stable"; see B-1, the card contents overlap each other. |
| 5 | [desktop] title: Continue restores the saved month | same story-card click timeout (B-1). |
| 6–7 | [desktop] town ×2 (`town navigation…`, `financial policies save…`) | same story-card click timeout (B-1). |
| 8–10 | [desktop] world ×3 (`town world fits 1280/1440/1920`) | same story-card click timeout (B-1). |
| 11 | [mobile] hud: UI gallery at scale 3 | `expect(brokenImages).toEqual([])` — 6 icon PNGs not decoded (same as #1). |
| 12–13 | [mobile] hud: UI gallery at scale 4 / 6 | `locator.click: Timeout` on `Load HUD example` — `<span>Auto-time off</span> from [role=group "Time controls"]` intercepts pointer events: the fixed control bar covers the gallery button at 390 px. **Known** (mobile gallery). |
| 14 | [mobile] reveal: comparison selectors show paired charts… | `toBeVisible` failed: `getByText('If you had: Keep what you had before')` not found — what-if run never resolved (see M-1). |

Skipped: world ×3 on mobile (by design).

## 2. Findings

Severity: **blocker** = cannot play as intended · **major** = wrong screen/visibly broken vs README · **minor** · **polish**.
Owner guess: title/reveal = A5, HUD/kit = A2, windows = A3, flow/menus = A4, world/engine = A1.

| ID | Sev | Screen | Steps | Expected (README) | Actual | Screenshot | Console | Owner |
|---|---|---|---|---|---|---|---|---|
| B-1 | blocker | Story picker | Title → New Story | Four wood story cards with portrait, title, description, three facts and "Begin this story" | Cards render as **empty wood bars**; portraits, descriptions, facts and "Begin this story" spill out below and **overlap each other into one unreadable line across the screen**. Clicking the centre of the "College Student" card **starts "Established Professional"** (the overflowed content of card 3 sits over card 1; HUD showed Established Professional, cash $6,000). Same at 1280, 1440, 1920. Cause: `.fv-story-card` styles `display:flex; flex-direction:column` on the `<button>`, but the kit `Button` wraps children in `span.fv-button__content > span` (nowrap, fixed button height), so the layout never applies. | `02-story-picker-1440x900.png`, `02-story-picker-1920x1080.png` | none | A5 (adopt kit Button structure) / A2 |
| M-1 | major | Results → What if | Finish → pick "All my decisions" / any decision | Two side-by-side charts with shared axes + change strip | Right-hand chart shows **"Re-running 1,000 futures…" spinner forever** (still spinning 30 s+ at 1280/1440/1920 and on mobile test #14). Only the left "What you did" chart renders. No console/page error, so the worker promise never resolves or rejects. | `16-whatif-1440x900.png`, `17-why-1440x900.png` | none | A1 (whatIf worker / `runWhatIfAsync`) with A5 |
| M-2 | major | Results | Finish & reveal → Finish now | Full-screen dusk town (lit windows, lamp glow, fireflies) with a parchment ledger | Reveal is mounted inside the legacy **"Your Next Chapter" modal** (`App.tsx` → `PanelHost` → `RevealChart`): daytime town, extra "Your Next Chapter" heading, a **Close panel** button that receives initial focus, and the whole ledger scrolls inside the dialog (fullPage screenshots are identical to the viewport). No dusk. | `15-results-1440x900.png`, `14-finishing-overlay-1440x900.png` | none | A4 (router) / A5 |
| M-3 | major | Any window / dialog | Open Pine Bank (or Timeline, Pause, Options, Finish early?) | Header: plaque with name, portrait on the left, `?` and `×` on the right | The **title plaque renders below the wood frame** ("Pine Bank", "Your timeline", "Paused", "Options", "Finish early?" all sit in a parchment plate under the window); the header is an empty brown band with only `×`. No building portrait, no hint plaque, no `?` in the header. At 1280×720 the Market Hall and Your Home title plate is pushed **off the bottom of the viewport**. | `04-window-bank-1440x900.png`, `05-window-market-1280x720.png`, `08-timeline-1440x900.png` | none | A2 (Window/Modal) |
| M-4 | major | Building windows | Open Pine Bank / Office / Market | Body = parchment with three insets (Now / Your decision / What happens next), kit fields and wood buttons | Panels are the old sheet UI nested inside the window: a second "Bank"/"Office"/"Market" heading with its own `?`, native `<details>` triangles ("Debts", "Extra debt payment", "History & details"), **flat dark-green "Save …" buttons** and plain beige inputs (not wood/parchment kit); inset 9-slice shows small white notch artefacts at the corners/mid-edges of the inner frame. | `04-window-bank-1440x900.png`, `05-window-office-1440x900.png`, `05-window-market-1440x900.png` | none | A3 |
| M-5 | major | Pause menu / Options / Finish early / Restart | Esc → Options | Kit wood buttons, Field/Select/Toggle in a parchment window | Pause menu, Options, Guide, Finish early? and confirm dialogs use the legacy `pixel-button`/`pixel-panel` classes: buttons wrap onto two rows ("Restart this story" alone on row 2); Options shows **native checkboxes and a native `<select>` with the labels run together** ("Sound☑ Reduce motion☑ Tips") and a duplicate "Options" heading; focus ring on these buttons is a dashed 3 px outline instead of the 2-art-px `O` outline. | `10-pause-menu-1440x900.png`, `11-options-1440x900.png`, `13-finish-confirm-1440x900.png` | none | A4 |
| M-6 | major | Town (toasts) | Play 3 months | Toasts stack on the right, under the HUD, as parchment boards | Toasts are legacy `pixel-panel notice` cards with **emoji icons (🔔)** in the system emoji font; the stack grows **upward under the HUD** so the newest toast's title is clipped behind the HUD when 3 toasts are tall (first run, `Dismiss …` button measured at y = −74); the stack covers the Health House / Market Hall plaques and the "!" badges on the right third of the town. | `06-next-month-3-1440x900.png` (earlier run showed the clipped state) | none | A4 (A2 for Board) |
| M-7 | major | Title | Load | Three wood buttons; Continue disabled | Disabled **Continue** is semi-transparent and a **cottage sprite shows through it** (scene cottage drawn under the menu row). Options/Guide corner labels sit *below* their icon buttons and are **clipped by the viewport bottom** at 1440×900 and 1920×1080. | `01-title-1440x900.png`, `01-title-1920x1080.png` | none | A5 |
| M-8 | major | Keyboard | Tab through town | Every interactive element shows a 2-art-px `O` outline on `:focus-visible` | The five building buttons report `outline: none` on focus (hover-style glow only, hard to see); legacy `pixel-button`s (Finish now / Keep playing / event options) show a dashed 3 px outline; `a.skip-link` is in the Tab order **between the buildings and the HUD** (jumps to a hidden link). Tab order in reveal goes through the four chart legend `<g>` items before any control. Everything *is* reachable; Escape from a window returns focus to its building. | `kb-03-game-focus-1440x900.png`, `kb-05-reveal-focus-1440x900.png`, `test-results/qa-keyboard.txt` | none | A1 (building focus) / A4 (skip link, legacy buttons) / A5 (reveal order) |
| m-1 | minor | Results chart | Finish after 3 months | Readable labels | "Lucky (90th)" / "What actually happened" / "Typical" labels overlap each other and the line ends when values are within a few hundred dollars; the Y axis shows 5 ticks of −$13,267…−$15,132 for a 3-month game (fine) but label text collides with the gold line end-cap. | `15-results-1440x900.png` | none | A5 |
| m-2 | minor | Town | Load | Reference: small plaques directly under each building; lamp left of fountain, bench right | Plaques sit on **large parchment plates** (~250×60 px) that read as separate UI slabs rather than name plaques; the left map edge shows a **clipped vertical wooden sign** (x 0–20, y 150–350) that is unreadable; "Timeline ↗" icon overlaps the last letter. Otherwise the town matches the reference well (buildings, paths, river, fountain, trees, HUD, control bar). | `03b-town-tips-dismissed-1440x900.png` | none | A1 / A2 |
| m-3 | minor | Town (tips) | New game | Tips should not hide the thing they describe | Coach tip "Explore the town" is a legacy `coach-tip` box covering the Pine Bank plaque and Your Home; it uses the legacy panel style, not the kit Board. | `03-town-1440x900.png` | none | A4 |
| m-4 | minor | Control bar | Event pending | "Next month in 01:00" | "Decision waiting" wraps to two lines and pushes the countdown cell taller than the bar. | `06-next-month-3-1440x900.png` | none | A2 |
| m-5 | minor | Event card | Open building with pending event | Pinned notice card in kit style | `EventCard` is a legacy `pixel-panel` with two full-width beige buttons and "OFFLINE OPPORTUNITY" tag; `Office` type-B offers render separately inside the panel (Accept/Decline green buttons) so the `.event-actions` card never appears for the Office. | `07-event-open-1440x900.png` | none | A3 / A4 |
| m-6 | minor | Gallery | `/src/ui/dev/index.html` at 390 px | Gallery usable | Fixed control bar covers the "Load HUD example" button (known). | — | none | A2 |
| p-1 | polish | Continue | Reveal → Choose a new story → Continue | Restores saved game | Works: "Continue · Month 3 · College Student" restores Month 3 / 24 at all sizes. The HUD name "Established Profession…" truncates with an ellipsis (fine). | `19-continue-1440x900.png` | none | — |
| p-2 | polish | Console | Whole run | No console errors | Only error per run is the intentional `503 /api/ai`. No page errors at any size. | — | `Failed to load resource: 503` | — |
| p-3 | polish | Title / picker | Resize | No page scroll | No horizontal or vertical page scroll at 1280/1440/1920 on any screen (measured each step). | audits in `test-results/qa-*.json` | none | — |

Not covered this pass: 390×844 play-through (mobile run was cut for time; the existing mobile suite passes except the
gallery and what-if tests), sound, and the custom-story letter beyond opening it (`20-custom-story-*.png`).

## 3. Top 10 (for triage)

1. B-1 story picker layout broken / starts the wrong story — A5 (+A2)
2. M-1 what-if comparison never finishes — A1/A5
3. M-2 reveal mounted in legacy "Your Next Chapter" modal, no dusk — A4/A5
4. M-3 window title plaque renders under the frame; windows overflow at 1280×720 — A2
5. M-4 building panels still legacy sheet UI inside the kit window — A3
6. M-5 pause / options / confirm dialogs use legacy buttons and native controls — A4
7. M-6 toasts legacy style, emoji icons, clipped under HUD — A4
8. M-7 title Continue button see-through; corner labels clipped — A5
9. M-8 focus visibility (buildings `outline:none`, skip link in Tab order) — A1/A4
10. m-1 reveal chart label collisions — A5
