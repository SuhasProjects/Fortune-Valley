# Agent 1 (Claude, lead): the world, the art pipeline, integration

Read [README.md](README.md) first (vision, palette, scale system, contracts, ownership). This file covers only your work.
Branch: `agent1-world`. You are also the **only one who merges to `main`**.

**Plain English:** you build the town itself, made from real pieces instead of one picture: the tool that turns
text-drawn pixel art into game graphics, the ground (grass, winding paths, river), the five buildings and every prop,
the animations, the hover and "decision waiting" effects, the crisp no-stretch scaling, and a dusk version for the
results screen. Then you merge everyone's work in order and do the final cleanup.

You get the heaviest load because the town *is* the game's look, and the previous human attempts (canvas-drawn art, then
a pasted image) were rejected. Quality is the whole job: the target is
`docs/art-reference/main-screen-reference.png`, and at 1440×900 a side-by-side should read as the same game.

---

## 0. What exists now (so you don't need to read it)

- `src/components/town/TownScene.tsx`: renders `public/assets/town-valley-v2.png` (an older 1536×1024 town, not the
  reference) as an `<img>` with five absolutely positioned `<button class="town-hotspot">` hotspots from `buildings.ts`
  (`{title, hint, color, x, y}` percent positions). Exports `TOWN_ART`, `BuildingSprite` (SVG crop of the image, used
  nowhere important), `TownScene({ onBuildingClick, eventBuilding?, eventBuildings? })`. Button names are
  `Open ${title}: ${hint}` + `. Decision waiting`; the badge is `<span aria-label="Decision waiting">!</span>`.
- `src/components/town/TownScene.test.tsx`: two jsdom tests (five buttons call the right id; only one badge; clicking the
  `region` does nothing). Keep these assertions alive in your new world test.
- `src/components/layout/FullscreenGameView.tsx` (Agent 4) stacks `.fullscreen-town-layer` (scene), HUD, status and clock
  layers; `src/styles/game-viewport.css` (Agent 4) currently forces the image to `object-fit: fill`. That is the
  stretching bug the user hates. Agent 4 replaces this with `GameScreen` wrapping your `GameStage`.
- `src/components/layout/PixelArt.tsx` (Agent 2): SVG-drawn icons/portraits and `WorldBackdrop` (an SVG landscape behind
  the old landing). Rejected style; do not reuse.
- No art pipeline, no `public/art/`, no `src/game/` exist yet. Python 3 with Pillow 11 is available on Akhilesh's Mac
  but **not** in CI; write the pipeline in Node (ESM `.mjs`) so it runs everywhere. Add `pngjs` as a devDependency (you
  own `package.json`); no native modules.
- Reference image facts: 2030×1181. Measured art-pixel cell ≈ **6.9 screen px** (AI-upscaled, so not perfectly uniform),
  so the reference town is ~294×171 art px. Our core is 320×180, so objects keep their native size and spacing grows ~8%.

---

## 1. Phase 0 (first ~45 min): contract stubs, then merge everyone's stubs

Push `[agent1] contracts: GameStage, TownWorld, Sprite, landmarks, palette` with:
- `src/game/stage/GameStage.tsx` + `useStageScale()`, real implementation (it is small; section 4).
- `src/game/world/TownWorld.tsx` with the final props (README §9) that, for now, renders the existing `TownScene`
  inside the stage so nothing breaks.
- `src/game/world/landmarks.ts` exporting `BUILDINGS` (title + hint, same strings as today) and `BUILDING_IDS`;
  change `src/components/town/buildings.ts` to re-export from it (keep `x`, `y`, `color` until TownScene is deleted).
- `src/game/art/Sprite.tsx` and `BuildingPortrait` stubs (render a labelled placeholder box).
- `art-src/palette.json` (keys/names/hex from README §4) and generated `src/styles/palette.css`
  (`:root { --c-outline: #4a311c; … }`). Ask Agent 2 to `@import './palette.css'` from `index.css` (their file),
  or import it from `GameStage.tsx` yourself until they do.

Then merge the five Phase 0 stubs in this order: 2, 1, 4, 3, 5. Resolve only trivial conflicts; bounce anything bigger.

---

## 2. The art pipeline (`scripts/art/`, npm scripts in `package.json`)

Text-grid format is defined in README §6. Build these scripts (Node ESM, `pngjs` only):

| Script | npm | Does |
|---|---|---|
| `compile.mjs` | `art` | Every `art-src/**/*.txt` → `public/art/**/name.png` (frames left-to-right) + `name.json` `{w,h,frames,anchor,slice}`. Fails loudly on unknown keys, wrong row lengths or frame counts. Writes `src/game/art/manifest.ts` (`export const SPRITES = {...} as const; export type SpriteName = keyof typeof SPRITES`). Deterministic output (sorted keys) so diffs stay clean. |
| directives | | `variants hover` appends a frame with a 1-art-px `O` outline grown outside the silhouette (the building hover state). `variants lit` appends a frame with glass `9`/`8` swapped to `7` (dusk windows). `variants door` expects a hand-drawn extra frame. |
| `extract.mjs` | `art:extract` | Crop a reference rect, sample per cell (mode colour of the inner 60% of each cell, to avoid seams), snap to nearest palette colour (CIEDE2000 or weighted RGB), flood-fill transparent from the crop border through grass/path/stone-ground keys, write a `.txt` grid. Options `--cell 6.9 --offset ox,oy` (tune the offset so cells line up; try offsets 0–6 and keep the one with the fewest distinct colours per cell). |
| `preview.mjs` | `art:preview` | 8× zoom PNG of a grid (all frames) into `.art-preview/` (add to `.gitignore`). |
| `ground.mjs` | `art` (runs after compile) | Builds the ground layer (section 3). |
| `compare.mjs` | `art:compare` | Put the reference (scaled to 1280 wide) and `docs/screenshots/world-1280.png` side by side plus a 50% blend into `.art-preview/compare.png`. Use it after every visual change. |

Add `npm run art` to nothing else in CI; compiled output is committed. Add a unit test `scripts/art/compile.test.ts`
(Vitest can run it; include `scripts/**/*.test.ts` in the Vitest config only if needed, which you own) covering the
parser errors, frame layout and the `hover` outline variant.

---

## 3. The ground (grass, paths, plaza, river)

The ground is drawn at full art-pixel resolution from a **material mask**, then textured. This gives the reference's
organic winding paths, which 16-px tiles cannot.

1. `art-src/world/ground-mask.txt` is a 480×288 text grid using *material* keys only: `h` grass, `a` path, `s` plaza
   stone, `u` water, `w` riverbank dirt, `j` flowerbed soil (yes, it's a big file; edit it with scripts, not by hand).
   - **Core (offset 80,54, size 320×180):** generate it with `extract.mjs --materials` from the reference (classify each
     cell as grass/path/water/bank/stone), then clean up: smooth path edges into rounded blobs like the reference, make
     sure every building door connects to the fountain plaza, paths run off the core edges at the same places as the
     reference (left middle, right middle, bottom middle, top behind the office), river occupies the bottom-left with a
     stair-stepped dirt bank.
   - **Outer ring (decorative scenery for wide/tall screens):** continue every path off-map, continue the river out of the
     bottom-left corner and along the bottom edge, add a dirt farm plot with crop rows on the far left, a pond or second
     river bend on the far right, and a tree line along the top and both sides. It must look intentional at 1536×864
     (scale 4, 384×216 visible) and 1440×900 (360×225 visible); nobody should be able to tell where the reference ended.
2. Texture tiles (16×16 text grids in `art-src/world/tiles/`): `grass-0..3` (base `h` with sparse `g`/`H` pixels and the
   reference's little 3-px `j` tuft marks), `path-0..1` (`a` with sparse `A` speckles), `plaza` (stone `s`/`z` cobbles with
   `S` mortar), `water-0..2` (animation frames: `u` with `U` ripple dashes drifting 1 px per frame), `soil`.
3. `ground.mjs` fills each material by sampling its texture tile (choose the grass variant by a hash of tile x,y so it
   doesn't repeat visibly), then runs an **edge pass**: path pixels touching grass become `d`, and grass pixels touching
   path become `D` on the lower/right sides only (that is the reference's rim). Water touching bank gets `V`; bank gets `w`
   with `W` stair steps. Grass tufts never sit on edges.
4. Output: `public/art/world/ground.png` (static, everything except water) and `public/art/world/water.png` (3-frame sheet
   containing only the water pixels, transparent elsewhere). Water animates over the ground at 400 ms per frame.

---

## 4. Stage and scale (`src/game/stage/`)

- `GameStage` = `<div class="fv-stage">` with `position: fixed; inset: 0; overflow: hidden; background: var(--c-grass)`.
  On mount and on `resize` it computes `px = max(2, floor(min(innerWidth/320, innerHeight/180)))`, plus
  `viewW = innerWidth/px`, `viewH = innerHeight/px`, and sets `--px: ${px}px`, `--view-w`, `--view-h` on the root.
  Context provides `{px, viewW, viewH}` to `useStageScale()`.
- Layers: `.fv-world` (z 0) holds the `world` prop; `.fv-ui` (z 10, `position:absolute; inset:0; pointer-events:none`)
  holds `children`. Document: **direct children of `.fv-ui` get `pointer-events:auto`**, so HUD/toasts/windows work and
  empty space passes clicks to the world.
- The world box is `480*px × 288*px`, positioned with integer `left/top` so the core centre sits at the viewport centre.
  No `transform: scale`. All sprite sizes are `w*px`.
- `label` becomes the stage `aria-label`.
- Body must never scroll: `html, body { overflow: hidden }` while the stage is mounted (restore on unmount, since the
  title is also a stage).

---

## 5. Sprites (`art-src/world/**`)

Extract from the reference first, then clean up by hand in the text grid. **Never** ship the raw extraction; fix
noisy pixels, make outlines continuous `k`, make every material use exactly its three palette tones, and remove baked
plaques/text. Reference rects below are in reference pixels (x, y, w, h); trim them to the object.

| Sprite | Reference rect | Notes |
|---|---|---|
| `buildings/bank` | 150, 100, 451, 340 | blue roof `B/e/E`, big gold coin medallion, columns, double door; `variants hover lit`; draw a `door` frame |
| `buildings/office` | 771, 76, 461, 300 | teal roof `C/l/L`, clock gable (the clock face is a separate 12-frame `clock-hand` overlay so the hand shows the month), potted shrubs; `variants hover lit`, `door` |
| `buildings/hospital` | 1380, 125, 479, 315 | red roof, white gable with red cross, red double door; `variants hover lit`, `door` |
| `buildings/home` | 400, 620, 479, 300 | red roof, chimney, window box with flowers; `variants hover lit`, `door` |
| `buildings/market` | 1141, 630, 581, 330 | green roof, striped awning, produce crates (apples, oranges), side lean-to; `variants hover lit`, `door` |
| `props/fountain` | 883, 482, 250, 178 | 4 frames: water jet and basin ripples |
| `props/lamp` | 685, 447, 56, 126 | frame 0 day; frame 1 lit (glow `i` pixels) for dusk |
| `props/bench` | 1401, 518, 116, 61 | |
| `props/tree-round` | 1800, 900, 165, 165 (also 20, 908) | 2 frames: canopy shifts 1 px; shadow is part of ground or a separate `tree-shadow` |
| `props/bush`, `props/potted-shrub` | from beside the doors | 2-frame sway optional |
| `props/flowers-white`, `props/flowers-mixed` | 520, 500, 105, 65 and 1650, 1000, 90, 70 | 2 frames |
| `props/lilypad`, `props/lilypad-flower` | in the river | 2-frame bob |
| `fx/smoke` | (draw) | 5 frames, 7×10, rises from chimneys |
| `fx/badge` | (draw) | parchment speech bubble with red `I` "!", 11×13, 2-frame bob |
| `fx/firefly`, `fx/butterfly` | (draw) | 2 frames each |
| `props/*` for the outer ring | (draw or reuse) | pine tree, fence, crop rows, rock, stump, signpost, mailbox, hay bale, well. Same rules, same palette |

`BuildingPortrait` (for Agent 3's window headers and Agent 5's pickers) renders the building sprite frame 0 at 1× `--px`
inside a fixed box; add a `size` prop if Agent 3 asks for a smaller one.

---

## 6. `TownWorld` (`src/game/world/`)

- Objects are listed in `src/game/world/layout.ts`: `{ sprite, x, y, layer?, animate?, building? }` in **map** art-px
  coordinates (core offset 80,54 already applied). Depth sort by anchor y (`z-index = y`).
- **Core layout** (centre points, core coordinates; add 80,54 for map coordinates). Measured from the reference; adjust
  by eye using `art:compare`:

  | Object | centre x | centre y |
  |---|---|---|
  | Pine Bank | 59 | 42 |
  | Town Office | 158 | 35 |
  | Health House | 255 | 44 |
  | Your Home | 101 | 117 |
  | Market Hall | 226 | 120 |
  | Fountain | 159 | 87 |
  | Lamp post | 112 | 78 |
  | Bench | 230 | 84 |
  | Flower patch | 91 | 80 |
  | Trees | (17, 22), (296, 22), (16, 152), (297, 150) |
  | Plaque under each building | 4 art px below the building's door, centred |

- **Building = `<button>`** containing the sprite and an HTML **plaque** (Agent 2's `Plaque`, or a temporary local one
  until it lands) with the building title. Accessible name `Open ${title}: ${hint}` + `. Decision waiting` when in
  `eventBuildings`. Hover/focus: sprite switches to the `hover` frame (gold outline), lifts 1 art px, cursor pointer, plaque
  text darkens to `K`. Active: drops back down. `openBuilding === id` shows the `door` frame and keeps the outline.
- **Badge:** `fx/badge` bobbing above the roof peak, `aria-label="Decision waiting"` exactly once per marked building.
- **Ambient animation:** water (400 ms), fountain (150 ms), chimney smoke on Home and Health House (spawn every ~2.5 s,
  rise 12 art px over 5 steps), tree sway (900 ms), flowers and lily pads (700 ms), one or two butterflies crossing on a
  slow stepped path. Optional stretch: two tiny villagers (12×16, 4-frame walk) looping between doors along the paths.
  All of it stops on frame 0 under `prefers-reduced-motion` or `useSettings().reduceMotion` (Agent 4; import it
  once their stub lands, guard if undefined).
- `monthIndex` rotates the office clock hand (`monthIndex % 12`).
- `timeOfDay="dusk"`: an overlay `div` with `background: #4b3f78; mix-blend-mode: multiply; opacity: .55` over the
  ground and buildings, then above it (unblended) the `lit` frames' window pixels, the lamp's lit frame plus a 3×3-art-px
  glow halo sprite, and 6–10 fireflies. No interaction when `onBuildingClick` is omitted (render plain `div`s, no buttons).
- Clicking empty ground does nothing (test enforces it). The world `<section>` has
  `aria-label="Fortune Valley. Choose a building to manage your money."`; decorative sprites are `aria-hidden`.

---

## 7. Tests you own

- `src/game/world/TownWorld.test.tsx` (jsdom): port both `TownScene.test.tsx` assertions to `TownWorld`; add: no buttons
  when `onBuildingClick` is omitted; `openBuilding` sets `data-open`; badge count equals `eventBuildings.length`.
- `src/game/stage/GameStage.test.tsx`: scale formula at 1280×720, 1366×768, 1920×1080, 800×600 (min 2).
- `tests/world.browser.ts`: at 1280×720, 1440×900, 1920×1080 → no page scroll, `--px` is 4/4/6, every `<img>`/sprite in
  the world loaded (`naturalWidth > 0` or computed background image), hovering Pine Bank changes its frame, Tab reaches all
  five buildings in order, no console errors. Save `docs/screenshots/world-1280.png` and `world-1440.png` (these two you
  may commit).
- Delete `TownScene.test.tsx` only after `TownScene.tsx` is gone and the ported test is green.

---

## 8. Integration and cleanup (your second job)

- Merge in the order in README §11. Before merging any PR: rebase it onto `main` locally, run typecheck, unit, browser
  tests and build, and look at the screen at 1440×900. Reject PRs that add art outside the palette, hand-written
  frame/button CSS outside `src/ui`, financial math in UI, or deleted tests.
- Watch for the past failure modes: someone merging old `main` into a branch (look for reverted files in the diff),
  rival copies of engine logic, deleted tests.
- Engine requests from others (a missing number, a selector) are yours; keep the engine deterministic and tested.
- **Final cleanup PR** (after all features merge): delete `public/assets/town-valley-*`, `src/components/town/TownScene*`,
  the `buildings.ts` shim (repoint imports to `landmarks.ts`), and with their owners' OK any leftovers (`PixelArt.tsx`,
  `world.css`, `welcome.css`, `game-viewport.css`, `Landing.tsx`, `TownIllustration.tsx`, `BuildingOverview.tsx`, unused
  `flow` components). Rename user-facing "Financial Town" strings to "Fortune Valley" anywhere left (package name may stay).
  Regenerate `docs/screenshots/` from a passing run. Update `docs/INTEGRATION.md` with the UI contracts and a short
  "how the art pipeline works" section, and replace this folder's docs with a short "final state" note if the team wants.

---

## 9. Done checklist

- [ ] `npm run art` rebuilds every PNG byte-for-byte deterministically; compiler tests pass.
- [ ] Town at 1440×900 vs reference via `art:compare`: same layout, buildings recognisably the same, same palette, no
      stray non-palette colours (add a test that scans `public/art/world/*.png` against `palette.json`).
- [ ] No stretching or blurring at 1280×720 → 2560×1440; outer ring looks designed.
- [ ] Water, fountain, smoke, leaves, flowers animate; reduced motion freezes them.
- [ ] Hover, focus, open-door and decision badge states all work by mouse and keyboard.
- [ ] Dusk mode looks good behind Agent 5's results ledger.
- [ ] Old image-based town and its CSS are deleted; all suites green on `main`.
