# Art pipeline

All pixel art in Fortune Valley is committed as **text grids**: one character per art pixel, using one-character
palette keys. A Node script (`pngjs` only) compiles them to PNG sprite sheets plus JSON metadata and a typed manifest,
so an agent can edit art exactly ("row 12, columns 4–9 become `O`") and diffs stay readable. Compiled output is
committed; the Vite build never runs the pipeline.

```
art-src/**/*.txt  ──npm run art──▶  public/art/**/<name>.png + <name>.json
art-src/palette.json ─────────────▶  src/styles/palette.css   (--c-<name> variables)
art-src/world/ground-mask.txt ────▶  public/art/world/ground.png + water.png
                                     src/game/art/manifest.ts  (SPRITES, SpriteName)
```

| Script (`scripts/art/`) | npm | Purpose |
|---|---|---|
| `compile.mjs` | `npm run art` | Everything above, deterministically (fixed PNG filter/deflate, sorted walk). Fails with `file:line` on any bad grid. |
| `palette.mjs` | `npm run art:palette` | Validate `palette.json` and write `palette.css` only. |
| `ground.mjs` | (part of `art`) | Build the ground and water layers from the material mask. |
| `preview.mjs` | `npm run art:preview` | Zoomed PNG of one grid, every frame and variant, on a checkerboard. |
| `extract.mjs` | `npm run art:extract` | Sample a region of the reference image into a grid (or into a materials mask). |
| `clean.mjs` | `npm run art:clean` | Mechanical cleanup of an extracted grid. |
| `compare.mjs` | `npm run art:compare` | Reference vs. screenshot vs. blend, stacked, for eyeballing fidelity. |
| `grid.mjs` | | The shared parser/renderer (`parseGrid`, `expandFrames`, `renderSheet`, `formatGrid`); tested in `tests/art/pipeline.test.ts`. |
| `mask-from-reference.mjs`, `world-geometry.mjs` | | One-off that produced the initial `ground-mask.txt`; shared geometry constants mirroring `src/game/stage/scale.ts`. |

Setup on the team Mac: `export PATH=/Users/akhilesh/miniconda3/envs/fintown/bin:$PATH` before `npm`. On Windows the
CLI guard may skip the entry point; call the compiler directly:
`node --input-type=module -e "import {compileAll} from './scripts/art/compile.mjs'; compileAll()"`.

## The text-grid format

```
# art-src/world/props/lamp.txt        # "#" starts a comment anywhere
size 9x19                              # required: width x height of ONE frame
anchor 4,18                            # optional: foot point (x,y) for depth sorting; written to the manifest
variants lit                           # optional: derived frames appended after the authored ones (see below)
--- 0                                  # frame separator; name defaults to the frame index
.........
....SJ...
..WJSSJ..
…
```

Directives come before the first frame, one per line:

| Directive | Meaning |
|---|---|
| `size WxH` | Size of one frame in art px. Required. Every row must have exactly `W` characters and every frame `H` rows. |
| `frames N` | Number of authored frames (default 1). Frames are separated by `--- <name>` lines and laid out left-to-right in the sheet. |
| `anchor x,y` | Foot point, stored in the manifest (`anchor`). |
| `slice N` | 9-slice inset for UI frames; the kit uses it as `border-image-slice` with `border-width: calc(N * var(--px))`. |
| `variants hover,lit,lights` | Derived frames generated from frame 0 and appended after the authored frames: **`hover`** grows a 1-px gold (`O`) outline outside the silhouette (requires a 1-px transparent margin all round, or the compile fails); **`lit`** swaps window glass `9`/`8` to `7`; **`lights`** keeps only those `7` pixels, everything else transparent (the dusk overlay). Only these three names are allowed. |
| `speed MS` | Milliseconds per frame when animated (default 250 in the `Sprite` component). |
| `export 2x` | Also write `<name>@2x.png`. Supported; no grid uses it today. |
| `kind mask` | Not a sprite: the compiler skips it and leaves it to its own consumer (`ground-mask.txt` → `ground.mjs`). Default `kind sprite`. |

Frame names matter: `Sprite` loops only over frames whose name is a number (`0`, `1`, …); variants are never part of the
loop and are selected by name (`frame="hover"`).

### Palette keys

Every character in a grid must be a key in `art-src/palette.json` (`{ key, name, hex }`; `.` is transparent, 58 colours
in all). The compiler also emits each colour as `--c-<name>` in `src/styles/palette.css`, so code never uses raw hex.
Keys and names are stable; hex values may be refined. The full table with usage notes is in `docs/agents/README.md` §4.
The ones you will type most:

| Keys | What |
|---|---|
| `K` ink, `k` outline | outlines and text; every object has a 1-px `k` outline |
| `W w b n` | wood dark → shine |
| `P p q Q` | parchment shadow → paper |
| `G g h H j` | grass deep → light, tuft |
| `T t Y` | leaves |
| `D d a A` | path rim → light |
| `V v u U F` | water deep → light, foam |
| `S s z` | stone |
| `R r o` / `B e E` / `C l L` / `N x X` | roof red / blue / teal / green (dark, body, light) |
| `O` gold, `i` glow, `I` alert, `9 8 7` glass, glass shine, window lit | accents and windows |

Art rules (light from top-left, three tones per material, flat `G` shadows, no anti-aliasing, text never baked into
art) are in `docs/agents/README.md` §5.

## Drawing, previewing, compiling, using a sprite

1. **Draw.** Create `art-src/<area>/<group>/<name>.txt` (`world/`, `ui/`, `title/`; the path becomes the sprite name,
   e.g. `art-src/world/props/lamp.txt` → `world/props/lamp`). Leave a transparent margin if you want `hover`.
2. **Preview.** Writes a zoomed PNG with 1-px gaps between frames into the git-ignored `.art-preview/`:
   ```
   $ npm run art:preview -- art-src/world/props/lamp.txt
   wrote .art-preview/lamp.png
   $ npm run art:preview -- art-src/world/buildings/bank.txt --scale 6
   wrote .art-preview/bank.png
   ```
   The bank preview shows four frames: `0`, `hover`, `lit`, `lights`.
3. **Compile.** Rebuilds every sheet, the ground, the palette CSS and the manifest; the output is byte-identical for the
   same input, so `git status` stays clean when nothing changed:
   ```
   $ npm run art
   compiled 150 sprite(s)
   ```
   A bad grid stops the compile with its location, e.g. `art-src/world/props/lamp.txt:7: row has 8 pixels, expected 9`
   or `declared 2 frame(s) but found 1`.
4. **Use it.** The manifest is typed, so a wrong name is a compile error:
   ```tsx
   import { Sprite, BuildingPortrait } from '@/game/art/Sprite'
   import { SPRITES } from '@/game/art/manifest'

   <Sprite name="world/props/fountain" animate/>                 // loops frames 0..n at `speed`
   <Sprite name="world/props/lamp" frame="lit"/>                 // a variant by name
   <Sprite name="world/buildings/bank" frame="hover" className="fv-building__hover"/>
   <BuildingPortrait building="bank"/>                           // labelled portrait for headers and pickers
   SPRITES['world/props/lamp']   // { src: '/art/world/props/lamp.png', w: 9, h: 19, frames: ['0','lit'], anchor: [4,18] }
   ```
   `Sprite` renders a `<span>` sized `w × --px` by `h × --px` with the sheet as `background-image`, `image-rendering:
   pixelated`, and a `steps()` animation over the authored frames. It is `aria-hidden` unless you pass `label`.
   UI frames with `slice` are consumed by CSS instead:
   `border-image: url('/art/ui/frames/button.png') 4 fill / calc(4 * var(--px)) / 0 stretch`. Icons are plain `<img>`s
   of `/art/ui/icons/<name>[-16|-small].png` through the kit's `Icon`.
5. Commit the `.txt`, the regenerated `public/art/**` files and `src/game/art/manifest.ts` together.

## How the ground is built

The ground is not tiled; it is drawn at full art-pixel resolution from a **material mask**, which is what gives the
reference's winding paths.

- `art-src/world/ground-mask.txt` is a `size 480x288`, `kind mask` grid using only six material keys:
  `h` grass, `a` path, `s` plaza stone, `u` water, `w` riverbank dirt, `j` flowerbed soil. Any other key fails the compile.
  The 320×180 core at offset (80, 54) reproduces the reference; the outer ring is decorative scenery.
- `ground.mjs` (`buildGround`) textures each material with a seeded noise (`rng(20261024)`, so the result is stable):
  grass gets sparse `g`/`H` pixels and 3-px `j` tufts, paths `A` speckles and `d` flecks, stone a `s`/`z`/`S` cobble
  pattern, bank `w` with `W` seams, soil rows. An **edge pass** then reads the mask and writes the rims: path next to
  grass → `d`, grass above/left of path → `D` (the reference's rim), bank next to water → `W`, stone next to anything
  else → `S`, grass next to bank → `G`.
- Water is written separately as a 3-frame sheet containing only the `u` pixels: `U` ripple dashes drift one pixel
  per frame and `F` foam alternates where water meets the bank. `TownWorld` draws `world/water` over `world/ground`
  at `speed 400`.
- Outputs: `public/art/world/ground.png` + `.json` and `water.png` + `.json`; both appear in the manifest as
  `world/ground` and `world/water`.

Edit the mask with scripts rather than by hand (it is 288 lines of 480 characters). The original mask came from a
materials extraction of the reference (`mask-from-reference.mjs`); hand edits since are fine and the script is kept only
for reproducibility.

## Extracting from the reference

`docs/art-reference/main-screen-reference.png` (2030×1181) is the style target. It is never shown to players, but reading
pixels out of it to start a sprite is encouraged. Its art pixel is about 6.9 image pixels, hence `--cell 6.9`.

**`art:extract`** samples one colour per cell (the mode of the inner 60% of the cell, to avoid seams), snaps it to the
nearest palette colour (weighted RGB distance), flood-fills the background to transparent from the crop border through
grass/path keys, and writes a grid. The grid offset is auto-tuned (the offset whose cells are most uniform) unless you
pass `--offset ox,oy`.

```
$ npm run art:extract -- --rect 740,840,120,160 --cell 6.9 --out /tmp/crop.txt
wrote /tmp/crop.txt (16x22, offset 6,4)
```

Options: `--from <png>` (default the reference), `--rect x,y,w,h` (image px, required), `--cell` (default 6.9),
`--offset ox,oy|auto`, `--bg h,g,H,j,a,A,d,D` (keys treated as background; `--bg none` keeps everything), `--keys <keys>`
(restrict snapping to these palette keys), `--out <file>` (otherwise stdout), `--materials`.

With `--materials` every cell is classified as a ground material instead of a colour and the result is a `kind mask`
grid. This is how the core of `ground-mask.txt` was first produced:

```
$ npm run art:extract -- --rect 0,0,2030,1181 --materials --out /tmp/materials.txt
wrote /tmp/materials.txt (293x170, offset 6,6)
```

**`art:clean`** does the mechanical part of the cleanup an extraction always needs. Steps run in this order, each
optional: `--strip <keys>` (make those keys transparent), `--replace a=b,c=d` (swap keys), `--keep-largest` (keep the
largest 4-connected opaque blob plus any blob touching it, dropping stray specks), `--crop` (trim empty rows and
columns), `--pad N` (add an N-px transparent margin, which `hover` needs). Writes in place unless `--out` is given and
prints the new size:

```
$ npm run art:clean -- /tmp/crop.txt --keep-largest --crop --pad 1 --out /tmp/crop-clean.txt
/tmp/crop-clean.txt: 18x21
```

Then finish by hand: fix the outline, apply the three-tone rule, add `anchor` and `variants`, and preview.

**`art:compare`** scales the reference to a town screenshot's width and stacks reference / screenshot / 50% blend into
`.art-preview/compare.png`. Browser tests write `docs/screenshots/world-1280.png` and `world-1440.png`:

```
$ npm run art:compare
wrote .art-preview/compare.png (1280x2243: reference / docs/screenshots/world-1280.png / blend)
$ npm run art:compare -- docs/screenshots/world-1440.png
wrote .art-preview/compare.png (1440x2522: reference / docs/screenshots/world-1440.png / blend)
```

Use it after every visual change to the world; misaligned buildings or a drifting palette show up immediately in the blend.

## Where sprites live

| Folder | Owner | Contents |
|---|---|---|
| `art-src/world/buildings/` | world | the five buildings (`variants hover,lit,lights`, `anchor` on the foot line) |
| `art-src/world/props/` | world | fountain (2 frames), lamp (`lit`), bench, bushes, trees, flowers, lily pads |
| `art-src/world/fx/` | world | badge, smoke, glow, firefly |
| `art-src/world/ground-mask.txt` | world | the material mask |
| `art-src/ui/frames/`, `controls/`, `icons/`, `cursor/` | UI kit | 9-slice frames (`slice`), slider/toggle/scroll parts, icons in 10, 16 and 6 px (`-16`, `-small`), cursors |
| `art-src/title/` | title | sky dither, mountains, pines, meadow, cottages, sign, vines, portraits, favicon |

Layout positions for the world (art px on the 480×288 map) are code, not art: `src/game/world/layout.ts`.
