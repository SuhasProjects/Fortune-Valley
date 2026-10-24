# Agent 2: the UI kit, pixel icons, HUD and control bar

Read [README.md](README.md) first (vision, palette, `--px` scale system, materials, contracts, ownership).
Branch: `agent2-ui-hud`.

**Plain English:** you build the "material" the whole game's interface is made from: wooden buttons, parchment
boards, wood-framed windows, name plaques, tags, inputs, sliders, tabs, little pixel icons and a pixel mouse cursor.
Agents 3, 4 and 5 build all their screens out of your pieces, so you set the look of every menu and window. With those
pieces you also build the two bars the player looks at all game: the **top HUD** (name, date, Cash, Savings, Debt, Net
worth, Timeline) and the **bottom control bar** (Next month in, Auto, Pause, Next month, Finish & reveal), matching the
reference picture closely.

You are on the critical path: **your kit core must merge early** (README §11). Ship a usable `Button`, `Board`, `Window`,
`Modal`, `Plaque`, `Tag`, `Icon` in the first couple of hours, then refine.

---

## 0. What exists now

- Styling is spread across `src/styles/world.css` (163 lines: classes `.pixel-button`, `.pixel-button--gold`, `.text-button`,
  `.icon-button`, `.pixel-panel`, `.eyebrow`, `.offline-tag`, `.town-hud`, `.hud-stats`, `.notice`, `.story-list`,
  `.panel-dialog`, `.panel-heading`, `.close-panel` etc.), `src/styles/pixel-tokens.css` (`--ft-*` tokens, `--pixel: 4px`,
  `.pixel-border`, `.pixel-panel`), and `src/styles/index.css` (imports Tailwind, fonts, then `pixel-tokens.css`,
  `world.css`, `welcome.css`, `game-viewport.css`). **Other agents' current code still uses these classes.** Keep
  `world.css` and `pixel-tokens.css` working until the final cleanup; build the new kit beside them. Do not restyle legacy
  classes, because that would change other agents' screens under them.
- The HUD is currently inline JSX in `src/App.tsx` (Agent 4's file): `<header class="town-hud">` with brand, `<dl class="hud-stats">`
  (date, Cash, Savings, Debt, Net worth) and a `Timeline ↗` button calling `store.openTimeline`. It uses
  `monthLabel`, `usd` from `src/components/flow/format.ts` and `selectDebtTotal`, `selectNetWorth` from the store.
  The status tag logic (also inline in App) is:
  `paused → "PAUSED"`, `finished → "STORY COMPLETE"`, `aiStatus loading → "PREPARING OPPORTUNITY"`, `online → "AI CONNECTED"`,
  else `"OFFLINE READY"`.
- The control bar is `src/components/flow/GameClock.tsx` (Agent 4's): props
  `{ status, onAdvance, onPause(paused:boolean), onFinish, secondsRemaining?, autoAdvanceEnabled?, blocked?, onToggleAuto? }`;
  renders countdown (`role="timer"`, label `Next month in` / `Auto-time off` / `Decision waiting`, `MM:SS`), `Auto on/off`
  toggle (`aria-pressed`), `Ⅱ Pause` / `▶ Resume`, `Next month →`, `Finish & reveal`. Disabled rules: everything disabled
  when finished; `Next month` disabled unless playing.
- The modal is `src/components/town/PanelHost.tsx` (Agent 3's): native `<dialog>` + `showModal()`, Tab containment,
  `onCancel` → onClose (Escape), outside click via bounding box, restores previous focus on unmount, locks body
  scroll, `autoFocus` close button with `aria-label="Close panel"`, `aria-labelledby` heading. **Copy this behaviour into
  your `Modal`** (Agent 3 will switch PanelHost to wrap your Modal).
- Fonts are already bundled: Pixelify Sans 400/700 and VT323 via `@fontsource` imports in `index.css`.
- `src/components/layout/PixelArt.tsx` (yours): SVG-path icons `PixelIcon kind coin|book|leaf|calendar`, portraits and
  `WorldBackdrop`. That's the rejected drawn-in-code style; replace usages with your sprite `Icon`, then delete the file at
  cleanup (App and BuildingOverview import it today, so delete only once they don't).

---

## 1. Phase 0 (first ~45 min): stub PR

`[agent2] contracts: src/ui exports + Hud/ControlBar/StatusTag`:
- `src/ui/index.ts` exporting every name in README §9 with final prop types; crude styling is fine.
- `src/ui/tokens.css`: `:root { --px: 4px; }` fallback (the stage overrides it), font tokens, spacing, z-index scale
  (`--z-world:0; --z-ui:10; --z-hud:20; --z-toast:30; --z-overlay:50`), and `@import './palette.css'` once Agent 1's lands.
  Import `tokens.css` from `src/styles/index.css`.
- `src/game/hud/Hud.tsx`, `ControlBar.tsx`, `StatusTag.tsx`, `HudFooter.tsx` with final props.
- Ask Agent 4 (in the PR) to route `?dev=ui` in `App.tsx` to `src/ui/dev/UiGallery.tsx` (yours), a page showing every
  component in every state at scale 3, 4 and 6. You use it to develop, and Agents 3 to 5 use it to see what exists.

---

## 2. Art you draw (`art-src/ui/**`, text grids per README §6)

Use `npm run art:extract` on the reference HUD/control bar to get exact edges, then clean them up.

| Sprite | Size (art px) | Notes |
|---|---|---|
| `frames/board` | 12×12, `slice 4` | parchment board: `k` outline, `n`/`b` 1-px gold-brown inner border like the reference HUD, `p` fill, `Q` top highlight, `P` bottom shadow |
| `frames/wood` | 16×16, `slice 5` | plank frame with `W` seams, `b` lit top edge, corner nails (`S`/`z` pixels) for windows and the title sign |
| `frames/inset` | 8×8, `slice 3` | sunken `q` area |
| `frames/plaque` | 12×10, `slice 4` | parchment plate with two nail dots, like the building name plates |
| `frames/button`, `button-hover`, `button-pressed`, `button-primary`, `button-disabled` | 12×12, `slice 4` | wood face `n`, `k` outline, `b` 1-px bottom lip (pressed: no lip, content moves down 1 art px); primary face `O` with `n` lip |
| `frames/ghost` | 8×8, `slice 3` | thin `P` outline only (the reference's "Auto on" box) |
| `frames/tag` | 6×6, `slice 2` | `J` fill |
| `frames/field` | 8×8, `slice 3` | `Q` fill, `k` outline; `field-focus` with `O` |
| `frames/tab`, `tab-active` | 12×12, `slice 4` | wood tab on top of a board |
| `controls/slider-thumb` | 5×7 | wood knob; `slider-track` 6×4 `slice 2` |
| `controls/toggle` | 14×7, 2 frames | wood switch off/on |
| `controls/scroll-thumb` | 4×8 `slice 2` | for `ScrollArea` |
| `icons/*` | 10×10 (HUD size) and 16×16 (menus) | coin, calendar, leaf (savings), ledger (debt), purse (net worth), clock, pause, play, arrow-right, arrow-up-right, close, question, gear, book, scroll (timeline), bell, check, warning, sound-on, sound-off, save, home, cross (health), briefcase (office), bank, basket (market), quill, star |
| `cursor/pointer`, `cursor/hand` | 12×12 | Stardew-style pixel cursor. Cursor images don't scale, so export a 2× copy (ask Agent 1 for an `export 2x` directive or author 24×24) and use `cursor: url(...) 1 1, auto` on `.fv-stage` and on buttons |

Icons: 1-px `k` outline, three tones, readable at 10×10. Look at the reference HUD icons (coin, calendar, leaf, ledger).

---

## 3. Components (`src/ui/`)

Each is a small React component plus a CSS file next to it, imported from the component. All dimensions in
`calc(N * var(--px))`. Frames use `border-image: url(/art/ui/frames/x.png) <slice> fill / calc(<slice> * var(--px)) / 0 stretch;`
with `image-rendering: pixelated`. **No CSS gradients, blur, `backdrop-filter`, soft shadows or border-radius.** Shadows
are flat offset blocks (`box-shadow: 0 calc(2*var(--px)) 0 rgb(42 26 18 / .35)`).

| Component | Props (keep these names) | Behaviour |
|---|---|---|
| `Board` | `{ as?, padding?: 'sm'|'md'|'lg', className?, children }` | parchment board |
| `WoodFrame` | `{ children, className? }` | wood border around anything |
| `Window` | `{ title, plaque?, headerExtra?, onClose?, children, width?: 'sm'|'md'|'lg' }` | visual window: wood frame, header strip with `Plaque` title (Pixelify 700), optional left slot (`plaque`, e.g. a building portrait), right slot (`headerExtra`, e.g. help), close `IconButton` named `Close panel`; body is a `ScrollArea` on parchment. Widths sm/md/lg = 120/180/215 art px; max height `100dvh - 16 art px` |
| `Modal` | `{ title, onClose, children, width?, plaque?, headerExtra? }` | `Window` inside a native `<dialog>` with all of PanelHost's behaviour (see §0). Dialog accessible name = `title`. `::backdrop` flat `#2a1a12` at 45%. Opening: 2-step slide up 2 art px over 120 ms (`steps(2)`), none under reduced motion |
| `Button` | native button props + `{ variant?: 'wood'|'primary'|'ghost'|'text', size?: 'sm'|'md'|'lg', icon?: IconName, iconRight?: IconName }` | label Pixelify 700; heights 9/11/16 art px; `lg` is the title-menu size; press shifts content 1 art px; `:focus-visible` 2-art-px `O` outline |
| `IconButton` | `{ icon, label, size?, ...button }` | square; `label` is the aria-label and the tooltip |
| `Plaque` | `{ children, tone?: 'parchment'|'wood' }` | building name plates, window titles |
| `Tag` | `{ tone?: 'dark'|'gold'|'red'|'green', children }` | uppercase VT323 |
| `Inset` | `{ title?, children }` | grouped area inside windows (Agent 3's status/decision/preview zones) |
| `Field` | `{ label, hint?, error?, ...input/textarea }` (`multiline?: boolean`) | `<label>` above, error in `--c-money-down` with `role="alert"` |
| `NumberField` | `{ label, value, onChange, min?, max?, step?, prefix?: '$', error?, disabled? }` | `type="number"`, `inputMode="decimal"`; keep the visible `<label>` text exactly as passed (tests use labels like `Monthly savings contribution (USD)`, so the caller passes `aria-label` when needed: forward `...rest` to the input) |
| `Select` | `{ label, value, onChange, options: {value,label}[], disabled? }` | native `<select>` (keyboard/a11y for free) with a pixel arrow icon |
| `Slider` | `{ label, value, onChange, min, max, step, format?: (v)=>string }` | native `<input type="range">`, styled track and thumb |
| `Toggle` | `{ label, checked, onChange }` | `role="switch"` button |
| `Tabs` | `{ tabs: {id,label,icon?}[], value, onChange, children }` | `role="tablist"`, arrow-key navigation |
| `Tooltip` | `{ content, children }` | small parchment bubble on hover/focus after 300 ms |
| `Icon` | `{ name: IconName, size?: 10|16, label? }` | sprite; `aria-hidden` unless `label` |
| `Money` | `{ value: number, signed?: boolean, tone?: 'auto'|'neutral' }` | formats with `usd()` from `src/components/flow/format.ts`; `auto` = green if > 0 when signed, red if < 0; tabular nums |
| `Divider` | `{ vertical?: boolean, dashed?: boolean }` | `P` 1-art-px line; dashed for the control bar |
| `ScrollArea` | `{ children, maxHeight? }` | styled scrollbar (`::-webkit-scrollbar` + `scrollbar-color` fallback) |

Also `src/ui/useReducedMotion.ts` (OS setting OR Agent 4's `useSettings().reduceMotion` once available). Every kit
animation checks it.

Unit tests `src/ui/ui.test.tsx` (jsdom): Modal names the dialog by title, close button is `Close panel`, Escape calls
onClose, Tab wraps inside, focus returns to the opener; Tabs arrow keys; Toggle `aria-checked`; Money sign colours;
NumberField forwards aria-label.

---

## 4. HUD, control bar, status tag, footer (`src/game/hud/`)

Match the reference (README §8). Everything is HTML on top of the world, inside Agent 1's stage UI layer, sized in `--px`.

**`Hud({ onOpenTimeline })`** reads the store itself:
`config.title`, `monthLabel(config.startMonth, game.monthIndex)`, `game.monthIndex`, `config.durationMonths`,
`game.cash`, `game.savings`, `selectDebtTotal`, `selectNetWorth`.
- A full-width `Board` 15 art px tall, inset 2 art px from top/left/right, with these columns separated by
  vertical `Divider`s: **brand** (gold coin icon in a small wood square + `FORTUNE VALLEY` Pixelify 700 + scenario title
  in VT323 below), **date** (calendar icon + `Jan 2026`, below it `Month 0 / 24`, keeping the exact text `Month n / N`),
  **Cash** (coin), **Savings** (leaf), **Debt** (ledger), **Net worth** (purse; value red when negative), then a wood
  `Button` `Timeline` with `arrow-up-right` icon (accessible name must contain `Timeline`).
- Labels small (VT323, `k` at 75%), values large (VT323 `--fs-value`, tabular). Columns use fixed min widths so numbers
  changing never shifts the layout.
- **Value tick:** when a value changes, it flashes `--c-money-up` or `--c-money-down` and nudges up 1 art px for
  2 steps (600 ms), and a small `+$420` / `−$85` floats up 6 art px and fades in 3 steps. Reduced motion: colour
  flash only.
- Must fit at 1280 px wide (scale 4 = 320 art px): shorten labels before shrinking numbers; never wrap.

**`ControlBar(props)`**, same props as today's `GameClock` (`ControlBarProps` exported):
a centred `Board` near the bottom (5 art px up from the bottom edge), containing: countdown block (label `Next month in` /
`Auto-time off` / `Decision waiting`, value `00:58` in Pixelify 700 large, `role="timer"`) | dashed `Divider` |
`Auto on/off` as a `ghost` button with `aria-pressed` | `Pause` / `Resume` wood button with pause/play icon |
`Next month →` **primary** button | `Finish & reveal` as a `text` variant button. Keep the accessible names and disabled rules
from §0 exactly (the browser tests click them by name). Keyboard hints in `title`/Tooltip: Space = pause, N = next month
(Agent 4 implements the shortcuts).

**`StatusTag()`**: dark `Tag` under the HUD's left end, using the logic in §0. A small pulsing dot (2 frames) while
`aiStatus === 'loading'`.

**`HudFooter()`**: two tiny lines at the bottom corners in VT323, `k` at 60%:
"Fictional educational simulation · Assumptions are illustrative" and "USD · A little town. A bigger perspective."

Agent 4 places these inside `GameScreen`. You don't edit `App.tsx` or `GameScreen.tsx`. Hand Agent 4 the import lines
in your PR description.

---

## 5. Tests you own

- `src/ui/ui.test.tsx` (above) and `src/game/hud/hud.test.tsx`: HUD shows the five values from a store fixture
  (`useGameStore.setState`), net worth red when negative, `Month n / N` text, Timeline calls the prop; ControlBar disabled
  states for playing/paused/finished and the three countdown labels.
- `tests/hud.browser.ts`: gallery route `/?dev=ui` renders with no console errors at scale 4 and 6, no element uses a
  font other than Pixelify Sans / VT323 (check computed `font-family` of every visible text node's element), focus
  outline visible on Tab; in a started game (`openTitle` + `startStory` from `tests/helpers.ts`) the HUD fits on one row
  at 1280×720 and 1440×900.

---

## 6. Done checklist

- [ ] Every component in §3 exists, appears in the gallery, uses only palette colours, `--px` sizes and the two fonts.
- [ ] HUD and control bar placed next to the reference at 1440×900 look like the same UI (layout, proportions, icons,
      colours) with live values.
- [ ] Value ticks feel good; reduced motion respected.
- [ ] Agents 3, 4, 5 never needed to write frame/button/input CSS (if they did, move it into the kit).
- [ ] At the end: `PixelArt.tsx` and `world.css`/`pixel-tokens.css` deleted (or reduced to nothing) once nothing imports
      them; coordinate with Agent 1's cleanup PR.
