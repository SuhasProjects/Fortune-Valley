# Fortune Valley: overall directions and visual cohesion

**Read this whole file first, then your own `AGENT_N.md`.** Between the two you should not need to explore the repo.
This file is the single source of truth for how the game looks and how the work is split. If your agent file and
this file disagree, this file wins. Tell Agent 1.

| Agent | File | Job in one line | Branch |
|---|---|---|---|
| 1 (Claude, lead) | [AGENT_1.md](AGENT_1.md) | **The world.** Art pipeline, every town tile and sprite, the living town scene, the stage/scale system, integration | `agent1-world` |
| 2 | [AGENT_2.md](AGENT_2.md) | **The UI kit and the HUD.** Wood/parchment components, pixel icons, the top HUD bar and bottom control bar | `agent2-ui-hud` |
| 3 | [AGENT_3.md](AGENT_3.md) | **The building windows.** The five building panels, their events, rebuilt as in-world windows | `agent3-windows` |
| 4 | [AGENT_4.md](AGENT_4.md) | **Game flow.** Screen routing, clock, toasts, timeline/activity, pause menu, options, saving, finish sequence, sound | `agent4-flow` |
| 5 | [AGENT_5.md](AGENT_5.md) | **Title and results.** The Stardew-style title menu, story pickers, custom story, and the full-screen results | `agent5-title-reveal` |

---

## 1. Plain-English summary (for the humans)

The game works: the money math, the AI hookup, the five buildings and the end-of-game 1,000-futures reveal are done and
tested. **What is wrong is how it looks.** The last attempt pasted a picture of a town over the page and made parts of it
clickable. That is not a game, and it is gone. This round we **build** the town the way real pixel games are built: small
tiles for grass, paths and water, separate sprites for each building, tree, lamp and fountain, things that animate,
and real buttons and windows made of wood and parchment. The reference picture (`docs/art-reference/main-screen-reference.png`)
stays as the **target to match**, not as something we display.

- **Agent 1 (Claude)** builds the town itself: the tools that turn pixel drawings into game graphics, every building,
  tree, path and the river, the animations (fountain, water, smoke, hover glow), and the code that scales it crisply to
  any laptop screen without stretching. It also merges everyone's work.
- **Agent 2** builds the "material" everything else is made from: wooden buttons, parchment frames, name plaques, little
  pixel icons, sliders and inputs. With those it builds the top bar (money, date) and the bottom bar (pause, next month).
- **Agent 3** rebuilds the five building windows (Bank, Office, Health House, Home, Market) so they look like part of the
  world, using Agent 2's pieces. The money logic inside them already works and must not change.
- **Agent 4** makes the game flow: switching between title, game and results, the month clock, pop-up notices, the
  timeline, a pause menu, settings, saving, the "computing 1,000 futures" moment, and small sound effects.
- **Agent 5** builds the first and last screens: a Stardew-Valley-style title screen (big wooden "Fortune Valley" sign with
  vines, mountains in the haze, three wooden buttons), the story picker, the custom-story screen, and a full-screen
  results page with better charts.

Everyone works in their own folders, so nobody overwrites anyone else. Agent 1 merges in a fixed order (section 9).

---

## 2. The vision

Fortune Valley is a **cozy pixel-art life sim about money**. Open it and you are in a game, not on a website: a title
screen with a hanging wooden sign over a hazy valley, then a sunny top-down village where five buildings are where you
make your money decisions. Time passes month by month. At the end, a dusk view of the same village and a parchment
ledger show 1,000 possible futures.

**Feel:** warm, polished, slightly rustic, readable. Stardew Valley is the reference for *quality and feel*, not
something to copy. Everything on screen looks like it belongs in the same world: the HUD is a parchment board, buttons
are wood, windows are framed paper, the town moves a little (water ripples, smoke, swaying leaves) so it feels alive.

### The rule that replaces all earlier art direction

> The reference image is a **style and layout target**. It is never shown to players, never used as a background,
> and never has hotspots laid over it. The town is assembled at runtime from **tiles and individual sprites**, and
> every piece of UI is real HTML styled as wood and parchment.

Reading pixels *out of* the reference to make sprites is allowed and encouraged (Agent 1's pipeline does this). The
result must be separate sprites on a real tile map, not the picture.

### Banned (each of these has already been tried and rejected)

- Any full-screen raster of the town, title or results with click areas on top.
- Procedural "drawn in code" buildings, trees or UI (canvas `fillRect` art, SVG path art, CSS-box buildings). The old
  `PixelArt.tsx` portraits and `WorldBackdrop` SVG are examples of what not to do; they are being deleted.
- `object-fit: fill`, non-uniform scaling, fractional scaling of pixel art, blurred or smoothed pixel art.
- Website patterns in the game: sticky nav bars, hero sections, FAQ accordions on the main screen, sign-in buttons,
  marketing copy, Inter/system-sans fonts, pill buttons, soft drop shadows, glassmorphism, `backdrop-filter`, CSS
  gradients that look glossy.
- Phone-first layouts. **Laptop first** (1280×720 up to 1920×1080). Phones must not break or scroll sideways, and that is all.

---

## 3. Pixel scale system (everyone uses this)

All art is drawn in **art pixels** and shown at a whole-number zoom.

- **Logical world:** the town *core* is **320×180 art px** (16:9). It sits centred in a larger **480×288 art px map**
  whose outer ring is decorative scenery, so wider or taller windows show more world instead of bars or stretching.
- **Tile size:** 16×16 art px. The map is 30×18 tiles; the core is 20 tiles × 11.25 tiles, offset (80, 54) art px.
- **Zoom:** `scale = max(2, floor(min(viewportWidth / 320, viewportHeight / 180)))`. The core is always fully
  visible; the camera centres on it.
- **CSS variable `--px`:** the stage root (`.fv-stage`, Agent 1) sets `--px` to the current scale in CSS px
  (e.g. `4px`). **Every pixel-art dimension in UI CSS is written as `calc(N * var(--px))`.** A 1-art-px border is
  `var(--px)`. This is what makes the HUD, windows and world look like one thing.
- **Rendering:** `image-rendering: pixelated` on all sprites and canvases. Never `transform: scale()` by a fraction.

| Window | scale | Visible world (art px) |
|---|---|---|
| 1280×720 | 4 | 320×180 (exactly the core) |
| 1366×768 | 4 | 341×192 |
| 1440×900 | 4 | 360×225 |
| 1536×864 | 4 | 384×216 |
| 1920×1080 | 6 | 320×180 |
| 2560×1440 | 8 | 320×180 |

The UI layer is full-viewport HTML above the world. It is not inside the scaled world box, but it is sized with `--px`.

---

## 4. Master palette

All art and UI use only these colours. Each colour has a **one-character key** used in the text-grid sprite format
(section 6). Agent 1 owns the palette source (`art-src/palette.json`) and generates `src/styles/palette.css`, which
exposes each colour as `--c-<name>`. Use the CSS variables in code, not raw hex. If you need a colour that is not here,
ask Agent 1. Do not invent one. Values were sampled from the reference; Agent 1 may refine hex values in the first hour
but **keys and names do not change**.

| Key | Name (`--c-…`) | Hex | Used for |
|---|---|---|---|
| `.` | transparent | | |
| `K` | ink | `#2a1a12` | darkest outline, text on parchment at large sizes |
| `k` | outline | `#4a311c` | standard 1-px outline on every object and UI frame; body text |
| `W` | wood-dark | `#5c3a1e` | plank seams, shadowed wood |
| `w` | wood | `#865227` | wood mid tone, beams |
| `b` | wood-light | `#b45f25` | wood lit face, sign boards |
| `n` | wood-shine | `#c58b44` | wood highlight, button face |
| `P` | parchment-shadow | `#bea87d` | parchment bottom edge, dividers |
| `p` | parchment | `#d8cfa1` | HUD and panel fill |
| `q` | parchment-light | `#e5daba` | plaster walls, raised parchment |
| `Q` | paper | `#f3e8c6` | input fields, highlights, text on wood |
| `G` | grass-deep | `#3f7f3a` | shadows cast on grass |
| `g` | grass-shade | `#79ac49` | grass texture dark |
| `h` | grass | `#96c551` | base ground |
| `H` | grass-light | `#b0c349` | grass highlights |
| `j` | tuft | `#5aa852` | grass tufts |
| `T` | leaf-dark | `#226b35` | tree/bush shadow side |
| `t` | leaf | `#33963b` | tree/bush body |
| `Y` | leaf-light | `#8fce5a` | tree/bush lit side |
| `D` | path-edge-dark | `#b8862f` | path outline against grass |
| `d` | path-edge | `#d6b26c` | path rim |
| `a` | path | `#e6be52` | path fill |
| `A` | path-light | `#f0d27a` | path speckles |
| `V` | water-deep | `#0f5f8f` | river depth, bank shadow |
| `v` | water-dark | `#1482a3` | water body dark |
| `u` | water | `#1a8ad8` | water body |
| `U` | water-light | `#46b3e6` | ripples, fountain water |
| `F` | foam | `#e8f6fb` | foam, sparkle |
| `S` | stone-dark | `#4c555d` | lamp post, stone shadow |
| `s` | stone | `#9a9488` | fountain rim, foundations |
| `z` | stone-light | `#c9c4b5` | stone highlight |
| `R` | roof-red-dark | `#8d241b` | |
| `r` | roof-red | `#d9322e` | Health House, Your Home |
| `o` | roof-red-light | `#ef6a4f` | |
| `B` | roof-blue-dark | `#173b80` | |
| `e` | roof-blue | `#1e4fa3` | Pine Bank |
| `E` | roof-blue-light | `#3d74c9` | |
| `C` | roof-teal-dark | `#0d5b57` | |
| `l` | roof-teal | `#17808b` | Town Office |
| `L` | roof-teal-light | `#2aa7a8` | |
| `N` | roof-green-dark | `#0f4a3a` | |
| `x` | roof-green | `#1b6e54` | Market Hall |
| `X` | roof-green-light | `#328e6c` | |
| `O` | gold | `#f2c23c` | coins, hover outline, primary button, focus ring |
| `i` | glow | `#fff0a0` | lamp light, coin shine |
| `I` | alert | `#c8372b` | "!" badges, warnings |
| `M` | money-up | `#2f7a3a` | positive money text |
| `Z` | money-down | `#b5362a` | negative money text, debt |
| `J` | tag-dark | `#1d3b2c` | dark status tags ("OFFLINE READY") |
| `9` | glass | `#3a8be0` | windows |
| `8` | glass-light | `#a8d8ff` | window shine |
| `7` | window-lit | `#ffd36b` | windows at dusk |
| `f` | white | `#ffffff` | flowers, clock face |
| `5` | flower-pink | `#f29bb0` | flowers |
| `6` | flower-violet | `#9b7bd4` | flowers |
| `1` | sky-high | `#7fb6e8` | title sky top band |
| `2` | sky-low | `#cfe6f2` | title sky bottom band, haze |
| `3` | mountain-far | `#8a9cc4` | far mountains |
| `4` | mountain-snow | `#eef3fa` | snow caps |

Chart colours on the results screen also come from this table (Agent 5 maps them, see AGENT_5).

---

## 5. Art rules (sprites and tiles)

1. **Light comes from the top-left.** Every object has a lit side (top/left, light tone), a body tone and a shadow
   side (bottom/right, dark tone). Three tones per material, no more.
2. **Outlines:** every object (building, tree, prop, UI frame) has a 1-art-px `k` outline. Ground tiles have no outline;
   paths get a `D`/`d` rim against grass.
3. **Shadows:** objects cast a flat `G` shadow 1–3 art px down-right on grass. No soft or transparent shadows.
4. **No anti-aliasing, no gradients, no dithering on objects.** Large flat areas (sky, haze) may use 2×2 checker
   dithering between two adjacent palette colours.
5. **Proportions follow the reference**: chunky roofs (about half the building height), big readable doors and windows,
   name plaques on parchment under each building.
6. **Animation:** frame-based only (sprite sheets, CSS `steps()`), 2–6 frames, 120–900 ms per frame. Nothing tweens
   smoothly except whole UI windows opening (Agent 2's 120 ms slide). Respect `prefers-reduced-motion` and the
   Options "reduce motion" setting by freezing on frame 0.
7. **Text is never baked into art.** Building names, sign titles and numbers are live HTML text placed on sprite plaques.

---

## 6. Shared art pipeline (Agent 1 builds it; everyone uses it)

Pixel art lives in the repo as **text grids**, one character per art pixel using the palette keys above. Text grids
let an agent edit art exactly ("make row 12, columns 4–9 `O`"). A compiler turns them into PNG sprite sheets.

```
# art-src/world/props/lamp.txt
size 7x22            # width x height of ONE frame
frames 2             # optional; frames go left-to-right in the output sheet
anchor 3,21          # optional; foot point used for depth sorting
slice 3              # optional; 9-slice inset for UI frames (used as CSS border-image-slice)
--- 0
..kkk..
.kiOik.
...
--- 1
...
```

- `npm run art` compiles every `art-src/**/*.txt` to `public/art/**/<name>.png` plus `<name>.json` (size, frames,
  anchor, slice) and regenerates `src/game/art/manifest.ts` (typed list of sprite names and metadata). Compiled PNGs
  are committed so the build never depends on the pipeline.
- `npm run art:extract -- --from docs/art-reference/main-screen-reference.png --rect x,y,w,h --cell 6.9 --out art-src/…/name.txt`
  cuts a region out of the reference, samples one colour per art pixel (mode, not average), snaps it to the palette,
  removes the grass/path background to transparent and writes a text grid to clean up by hand.
- `npm run art:preview -- art-src/…/name.txt` writes an 8× zoomed PNG to `.art-preview/` (git-ignored) so you can look at it.
- Each agent owns its own subfolder: `art-src/world/**` (1), `art-src/ui/**` (2), `art-src/windows/**` (3),
  `art-src/title/**` and `art-src/reveal/**` (5). Agent 4 has no art. Output goes to the matching `public/art/<folder>/`.
- Until Agent 1's compiler lands (Phase 0, first hour) you can still write `.txt` grids; they compile later.

---

## 7. UI materials and typography

Agent 2 implements these as components in `src/ui/`. Nobody else writes frame, button or input styling. If a component
is missing, ask Agent 2 (or build it inside `src/ui/` with Agent 2's OK in the PR).

| Material | Look | Where |
|---|---|---|
| **Parchment board** | fill `p`, 1-px `k` outline, 1-px `Q` inner top highlight, 1-px `P` inner bottom shadow, 2-px flat `k` drop shadow at 35% | HUD bar, control bar, toasts, window bodies |
| **Wood frame** | planks `w` with `W` seams and `b` lit edge, `k` outline, little nail pixels in corners | window borders, title sign, menu buttons |
| **Wood button** | face `n`, 1-px `k` outline, 1-px `b` bottom lip; hover face lightens to `Q`-tinted `n`; pressed moves down 1 art px and loses the lip; primary = face `O`; disabled = face `P`, text `P`-dark | all buttons |
| **Plaque** | small parchment plate with `k` outline and two `W` nail dots | building names, window titles |
| **Tag** | `J` fill, `Q` text, 1-px `k` outline, uppercase | status tags |
| **Inset** | `q` fill, 1-px `P` inner shadow top/left | grouped fields inside windows |
| **Field** | `Q` fill, 1-px `k` outline; focus outline becomes `O` (2 art px); no glow | inputs, selects |

Frames are 9-slice PNGs (`border-image`, `border-image-slice` from the grid's `slice`, `border-width: calc(slice * var(--px))`)
so corners stay pixel-perfect at every zoom.

**Fonts** (already bundled locally through `@fontsource`; no network fonts):
- **Pixelify Sans 700** for headings, names, button labels, the logo.
- **VT323** for numbers, body text, labels. Numbers use `font-variant-numeric: tabular-nums`.
- Fallback `ui-monospace, monospace`. Nothing else, ever.
- Sizes are tokens in `src/ui/tokens.css` (Agent 2), in `--px` multiples: label `calc(3.5*var(--px))`,
  body `calc(4.5*var(--px))`, value `calc(5*var(--px))`, heading `calc(6*var(--px))`, title `calc(12*var(--px))`.
  At scale 4: 14 / 18 / 20 / 24 / 48 px.

**Money colours:** positive `--c-money-up`, negative/debt `--c-money-down`, neutral `--c-outline`. Format with
`usd()` from `src/components/flow/format.ts`. **Never compute money in UI**; only format engine values.

**Focus:** every interactive element shows a 2-art-px `O` outline on `:focus-visible`. Keyboard play must work end to end.

---

## 8. What each screen looks like

### Town (the main game screen); must look almost exactly like the reference

```
┌───────────────────────────── HUD (parchment board, full width, ~15 art px tall) ─────────────────────────────┐
│ [coin] FORTUNE VALLEY │ [cal] Jan 2026  │ [coin] Cash  │ [leaf] Savings │ [ledger] Debt │ [coin] Net worth │ Timeline ↗ │
│        College Student│ Month 0 / 24    │ $800         │ $300           │ $15,200       │ -$14,100         │            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 [OFFLINE READY]                                          (toasts stack here, right side, under the HUD)
     Pine Bank (blue roof, gold coin)    Town Office (teal roof, clock)     Health House (red roof, red cross)
              [lamp]   [flowers]               ( fountain )                    [bench]
 ~river~       Your Home (red roof)                                        Market Hall (green roof, awning, produce)
 ~~~~~~~                        ┌──── control bar (parchment) ────┐
 ~~~~~~~                        │ Next month in │ Auto on │ ⏸ Pause │ Next month → │ Finish & reveal │
 tiny footer: "Fictional educational simulation · Assumptions are illustrative"  ···  "USD · A little town. A bigger perspective."
```
Winding tan paths connect every door to the fountain plaza and run off the map edges. Trees in each corner, bushes by
doors, flower patches, a lamp post left of the fountain, a bench right of it, the river in the bottom-left with lily pads.

### Building window (any of the five)
The town stays visible and dimmed (flat `K` at 45%) behind a centred **wood-framed window**, max 860 px wide (at scale 4).
Header: plaque with the building name, small building portrait sprite on the left, `?` help and `×` close on the right.
Body: parchment with three insets: *Now* (status), *Your decision* (controls), *What happens next* (12-month preview).
Pending events for that building appear as a pinned notice card at the top of the body.

### Title
Full-screen illustrated scene, built from layers: banded sky (no clouds), three mountain ranges fading into haze, a
pine forest line, a green valley with a few cottages and a path. Centre-top: a big **hanging wooden sign** reading
FORTUNE VALLEY in Pixelify Sans, with green vines and small leaves draped along the top and down both sides. Below: three
large wood buttons in a row: **New Story**, **Custom Story**, **Continue**. Bottom corners: small wood icon buttons for
Options (gear) and Guide (book). No website chrome.

### Results (reveal)
The same town at dusk (Agent 1's `timeOfDay="dusk"`: lit windows, lamp glow, fireflies), non-interactive, with a large
parchment **ledger** over it: outcome headline, tabs for *Futures / Spread / Choices vs default / Why?*, pixel-styled charts,
and a wood **Play again** button.

---

## 9. Code architecture and contracts

```
main.tsx ─ App.tsx (Agent 4: screen router)
   ├─ screen "title"   → <TitleScreen/>                 Agent 5  src/game/title/
   ├─ screen "game"    → <GameScreen/>                  Agent 4  src/game/GameScreen.tsx
   │     └─ <GameStage world={<TownWorld …/>}>          Agent 1  src/game/stage/, src/game/world/
   │          ├─ <Hud/>, <ControlBar …/>, <StatusTag/>  Agent 2  src/game/hud/
   │          ├─ <ToastStack/>, timeline, activity,     Agent 4  src/game/flow/
   │          │   pause menu, options, finish overlay
   │          └─ <BuildingWindow building onClose/>     Agent 3  src/components/panels/
   └─ screen "reveal"  → <RevealScreen payload …/>      Agent 5  src/game/reveal/
UI kit used by 2, 3, 4, 5:  src/ui/  (Agent 2)      Engine + store + AI: unchanged (see section 12)
```

**Phase 0 (first ~45 minutes): contract stubs.** Each agent first pushes a tiny PR that exports its public components with
the exact props below, implemented crudely (wrapping today's code is fine), so everyone else compiles against the real
names from the start. Agent 1 merges all five stubs before anyone does real work on top of them.

```ts
// Agent 1: src/game/stage/GameStage.tsx
export function GameStage(props: { world: ReactNode; label: string; children?: ReactNode }): JSX.Element
//   full-viewport fixed root .fv-stage; sets --px, --view-w, --view-h (art px); children = UI layer above world
export function useStageScale(): { px: number; viewW: number; viewH: number }

// Agent 1: src/game/world/TownWorld.tsx
export interface TownWorldProps {
  onBuildingClick?: (id: BuildingId) => void   // omitted = decorative, non-interactive (reveal backdrop)
  eventBuildings?: BuildingId[]                 // show the "!" badge over these buildings
  openBuilding?: BuildingId | null              // door-open frame + steady highlight
  timeOfDay?: 'day' | 'dusk'
  monthIndex?: number                           // Town Office clock hand position, seasonal flowers if time allows
}
// Agent 1: src/game/world/landmarks.ts (replaces src/components/town/buildings.ts, which re-exports it until cleanup)
export const BUILDINGS: Record<BuildingId, { title: string; hint: string }>
// Agent 1: src/game/art/Sprite.tsx: draw any compiled sprite at the current --px
export function Sprite(props: { name: SpriteName; frame?: number; animate?: boolean; className?: string; label?: string }): JSX.Element
export function BuildingPortrait(props: { building: BuildingId }): JSX.Element   // for window headers and pickers

// Agent 2: src/ui/index.ts
export { Board, WoodFrame, Window, Modal, Button, IconButton, Plaque, Tag, Inset, Field, NumberField, Select, Slider,
         Toggle, Tabs, Tooltip, Icon, Money, Divider, ScrollArea } from './…'
// Modal: native <dialog>, focus trap, Escape, outside click, restores focus. Props: { title; onClose; children; width?: 'sm'|'md'|'lg'; plaque?: ReactNode; headerExtra?: ReactNode }
// Close button accessible name is exactly "Close panel"; dialog accessible name is `title`.
// Agent 2: src/game/hud/
export function Hud(props: { onOpenTimeline: () => void }): JSX.Element          // reads the store itself
export function ControlBar(props: ControlBarProps): JSX.Element                 // same props as today's GameClock
export function StatusTag(): JSX.Element                                        // OFFLINE READY / AI CONNECTED / PAUSED …

// Agent 3: src/components/panels/BuildingWindow.tsx
export function BuildingWindow(props: { building: BuildingId; onClose: () => void }): JSX.Element
//   renders Modal + header + that building's pending events + its panel; reads the store itself

// Agent 4: src/game/settings/
export function useSettings(): Settings   // { autoAdvanceSeconds: 0|30|60|120, sound: boolean, reduceMotion: boolean, tips: boolean } persisted
export function OptionsWindow(props: { onClose: () => void }): JSX.Element
// Agent 4: src/game/audio/sfx.ts
export function sfx(name: 'click'|'open'|'close'|'coin'|'month'|'alert'|'reveal'): void   // no-op when sound is off

// Agent 5: src/game/title/TitleScreen.tsx, src/game/reveal/RevealScreen.tsx
export function TitleScreen(): JSX.Element            // starts games through the store itself
export function RevealScreen(props: { payload: FinishPayload; onPlayAgain: () => void }): JSX.Element
// Agent 5: src/game/title/GuideWindow.tsx: how to play, town, controls, FAQ; also opened from Agent 4's pause menu
export function GuideWindow(props: { onClose: () => void }): JSX.Element

// Agent 2: src/ui/dev/UiGallery.tsx: every kit component in every state; Agent 4's App routes `?dev=ui` to it
```

Changing a contract after Phase 0 needs a one-line note in your PR **and** an update to this section.

### Stable accessible names (tests rely on these; keep them)

| Element | Accessible name | Owner |
|---|---|---|
| Building buttons | starts with `Open Pine Bank:` / `Open Town Office:` / `Open Health House:` / `Open Your Home:` / `Open Market Hall:`, ends with `. Decision waiting` when an event is pending | 1 |
| Building windows | dialog named `Pine Bank`, `Town Office`, `Health House`, `Your Home`, `Market Hall` | 3 |
| Window close | `Close panel` | 2 (Modal) |
| Clock | buttons containing `Next month`, `Pause` / `Resume`, `Finish & reveal`, `Auto on` / `Auto off`; text `Month n / N` | 2 |
| Timeline / activity | button `Timeline`; button `View all activity`; dialogs `Your timeline`, `Town activity` | 2 (button) / 4 |
| Toast region | `Recent financial activity` | 4 |
| Panel internals | everything in `src/components/panels/panels.browser.ts` and `canonical/panels.test.tsx` | 3 |
| Title / reveal | whatever `tests/helpers.ts` says; Agent 5 keeps the helpers working | 5 |

---

## 10. File ownership (exclusive)

Only the owner edits these. If you truly need a change in someone else's file, ask them, or put it in your PR with their
written OK. **Never delete or weaken another agent's test.**

| Agent | Owns |
|---|---|
| 1 | `src/game/stage/**`, `src/game/world/**`, `src/game/art/**`, `scripts/art/**`, `art-src/palette.json`, `art-src/world/**`, `public/art/world/**`, `src/styles/palette.css` (generated), `src/components/town/TownScene.tsx`, `src/components/town/TownScene.test.tsx`, `src/components/town/buildings.ts`, `public/assets/town-valley-*` (delete), `docs/art-reference/**`, `tests/world.browser.ts`. **Plus engine and infra:** `src/engine/**`, `src/types/domain.ts`, `src/config/**`, `src/fixtures/**`, `src/services/**`, `src/dev/**`, `api/**`, `server/**`, `tests/engine/**`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `playwright.config.ts`, `vercel.json`, `.github/**`, `.gitignore`, `docs/*.md`, `docs/agents/**`, `docs/screenshots/**`, `README.md` |
| 2 | `src/ui/**`, `src/game/hud/**`, `art-src/ui/**`, `public/art/ui/**`, `src/styles/index.css`, `src/styles/pixel-tokens.css`, `src/styles/world.css` (legacy; delete at the end), `src/components/layout/PixelArt.tsx` (delete when unused), `tests/hud.browser.ts` |
| 3 | `src/components/panels/**`, `src/components/town/PanelHost.tsx`, `src/components/flow/EventCard.tsx`, `art-src/windows/**`, `public/art/windows/**` |
| 4 | `src/App.tsx`, `src/main.tsx`, `src/game/GameScreen.tsx`, `src/game/flow/**`, `src/game/settings/**`, `src/game/audio/**`, `src/components/flow/**` (except `EventCard.tsx`), `src/components/layout/FullscreenGameView.tsx`, `GameShell.tsx`, `BuildingOverview.tsx`, `AppShell.test.tsx`, `src/hooks/**`, `src/stores/**`, `src/styles/game-viewport.css`, `tests/town.browser.ts`, `tests/flow.browser.ts` |
| 5 | `src/game/title/**`, `src/game/reveal/**`, `src/components/landing/**`, `src/components/reveal/**`, `src/data/scenarios.ts`, `src/styles/welcome.css`, `art-src/title/**`, `art-src/reveal/**`, `public/art/title/**`, `public/art/reveal/**`, `public/assets/favicon.svg`, `index.html`, `tests/helpers.ts`, `tests/title.browser.ts`, `tests/reveal.browser.ts` |

**Dependencies:** only Agent 1 edits `package.json`. If you need a package, ask in your PR description. You should not
need one: React 19, Zustand, framer-motion, Recharts, Zod and Tailwind are already installed. Prefer plain CSS files
next to your components (import them from the component); Tailwind is available but not used by the game screens.

**Screenshots:** browser tests rewrite `docs/screenshots/*.png` and `src/components/panels/screenshots/*.png`. Do not
commit those changes (`git checkout docs/screenshots` before committing). Agent 1 regenerates them once at the end;
Agent 3 may commit its own panel screenshots.

---

## 11. Team rules, commands, merging

**Setup:** Node 22 (`.nvmrc`). On Akhilesh's Mac: `export PATH=/Users/akhilesh/miniconda3/envs/fintown/bin:$PATH`.
`npm install`, then:

| Command | What |
|---|---|
| `npm run dev` | game at http://127.0.0.1:5173 (`?dev=engine` opens the engine harness) |
| `npm run typecheck` | TypeScript (app + node configs) |
| `npm test` | Vitest, ~117 unit/integration tests |
| `npm run test:browser` | Playwright Chromium, projects `desktop` 1366×768 and `mobile` 390×844, files `tests/*.browser.ts` |
| `npx playwright test -c src/components/panels/playwright.config.ts` | Agent 3's panel stress-route suite (port 5174) |
| `npm run build` | production build |
| `npm run art` / `art:extract` / `art:preview` | pixel pipeline (after Agent 1's Phase 0) |

**Git rules (each was broken before and cost hours):**
1. Branch from current `main`: `git fetch origin && git switch -c <your-branch> origin/main`.
2. To catch up, `git fetch origin && git rebase origin/main`. **Never merge an old `main` into your branch.**
3. Before every push: `npm run typecheck && npm test && npm run test:browser`. All green or do not push.
4. Small PRs, one concern each. Title them `[agentN] …`. Say in the PR what you changed in contracts, if anything.
5. Never delete or weaken another agent's test. If your change legitimately breaks one, tell its owner.
6. No financial math in UI. Every number comes from `@/engine` or the store. Missing a number? Ask Agent 1.
7. Do not commit regenerated screenshots (section 10).

**Merge order (Agent 1 merges; nobody else merges to `main`):**
Phase 0 stubs (all five) → Agent 2 kit core → Agent 1 pipeline + palette → Agent 1 world v1 → Agent 2 HUD/control bar →
Agent 4 GameScreen/router → Agent 3 windows → Agent 5 title → Agent 5 reveal → polish PRs from everyone → Agent 1 final
cleanup (delete legacy CSS/components, regenerate screenshots, update docs).

**Done for the whole team means:**
- At 1440×900 a side-by-side with the reference looks like the same game: same layout, palette, materials, buildings.
- No stretching at any window size from 1280×720 to 2560×1440; extra space shows more valley.
- Every screen (title, picker, custom story, town, five windows, timeline, activity, pause, options, results) uses only
  `src/ui` materials, the palette and the two fonts.
- The town is alive (water, fountain, smoke, leaves, hover), and the whole game is playable by keyboard.
- Typecheck, unit tests, browser tests and build are green on `main`; no console errors.

---

## 12. Repo facts you can rely on without reading the code

**Stack:** React 19 + TypeScript 5.9 + Vite 7, Zustand 5 store, Recharts 3, framer-motion 12, Zod 4. Path alias `@/` = `src/`.
Fonts via `@fontsource/pixelify-sans` (400, 700) and `@fontsource/vt323`, imported in `src/styles/index.css`.

**Domain ids:** `BuildingId = 'bank' | 'office' | 'home' | 'hospital' | 'market'`. Display titles: Pine Bank, Town Office,
Your Home, Health House, Market Hall. Hints: "Savings & debt", "Income & career", "Rent & everyday costs",
"Hospital / Insurance", "Investments & allocation". `GameStatus = 'setup' | 'playing' | 'paused' | 'finished'`.

**Store** (`src/stores/useGameStore.ts`, `useGameStore` Zustand hook). State: `game: GameState | null`, `config: GameConfig | null`,
`openBuildingId`, `timelineOpen`, `historyOpen`, `personalizationLoading`, `personalizationError`, `lastActionError`,
`aiStatus: 'idle'|'loading'|'online'|'offline'`, `finishPayload: FinishPayload | null`, `savedGame: {savedAt,title,monthIndex} | null`,
`lastInsight`. Actions: `startGame(config)`, `advanceOneMonth()`, `dispatchAction(action)`, `openBuilding(id)`,
`closeBuilding()`, `setPaused(bool)`, `openTimeline()`, `closeTimeline()`, `setHistoryOpen(bool)`, `markNotificationRead(id)`,
`markAllNotificationsRead()`, `requestOpportunity()`, `requestExplanation(question?)`, `requestInsight(question)`,
`finishGame()` (runs 1,000 Monte Carlo paths synchronously, ~1 s), `resetGame()`, `generatePersonalized(prompt, numbers?)`
→ `{config, fallback, warnings}`, `saveGame()`, `loadSavedGame()`, `clearSavedGame()`, `refreshSavedGame()`.
Selectors: `selectNetWorth`, `selectDebtTotal`, `selectPendingEvent`. `advanceOneMonth` auto-saves.
`FinishPayload = { config, finalState, policyLog, monteCarlo: MonteCarloResult, explanation?: {text, source:'ai'|'fallback'} }`.

**GameState highlights** (`src/types/domain.ts`): `monthIndex`, `status`, `cash`, `savings`, `debts[] {id,name,balance,apr,minimumPayment}`,
`investments {stock,bond,etf}`, `policy`, `household`, `employment`, `insurance`, `activeEvents: GameEvent[]`
(`{id, type:'A'|'B', title, body, buildingTarget, options[{id,label,description}], source, learningNote?}`),
`notifications: GameNotification[]` (`{id, monthIndex, kind:'info'|'positive'|'negative'|'decision', summary, details?, relatedBuilding?, amountSigned?, read}`),
`timeline: TimelineEntry[]` (`{id, monthIndex, type:'choice'|'shock'|'milestone'|'policy_change'|'ai_event', description, netWorthAfter}`),
`netWorthHistory: number[]`, `ledger`, `policyLog`, `startMonth` ("YYYY-MM"). `GameConfig` has `title`, `archetype`,
`durationMonths` (24), `startMonth`, `narrativeFocus`.

**Engine** (`@/engine`, owner Agent 1, frozen except bug fixes): `createGame`, `advanceMonth`, `applyAction`,
`runMonteCarlo`, `compareWithBaseline`, `histogram`, `quantile`, `previewMonth`, `previewHorizon(state, overrides, months)`,
`netWorthOf`, `debtTotal`, `investmentsTotal`, `monthLabel`, `settleClaim`, `validateAllocation`, `selectPaySummary`,
save helpers. Contracts in `docs/INTEGRATION.md` and `docs/ARCHITECTURE.md`; AI in `docs/AI_API.md`.

**Formatting helpers:** `usd(value, signed?)` and `monthLabel(startMonth, monthIndex)` in `src/components/flow/format.ts`.

**Scenarios:** `src/data/scenarios.ts` exports `scenarios: GameConfig[]` (College Student, Entry-Level Worker,
Professional, Young Family), `scenarioCards` (`{id,title,description,focus}`), `freshScenario(id)` (new random seed), `scenarioById`.

**AI:** `/api/ai` serverless route (`api/ai.ts` + `api/_lib/*`), configured by server env `AI_API_KEY`, `AI_MODEL`,
`AI_PROVIDER`, `AI_BASE_URL`. With no key everything falls back offline (`src/services/aiFallback.ts`), so the game is
fully playable without AI. Browser tests stub `/api/ai` with 503.

**Known external issue (humans):** financegamething.vercel.app serves an old build; nobody on the team can reach that
Vercel project (it may be linked to the fork `randyphantom21-commits/financegamething`). Whoever gets access: point it at
`SuhasProjects/financegamething` `main`, set the AI env vars server-side, redeploy. Stale branches `frontendpixelart` and
`agent4-fullscreen` must not be merged.
