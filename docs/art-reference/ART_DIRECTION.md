# Fortune Valley — art direction (read this before touching any visual code)

**The target is the picture, not a description of it.**
`docs/art-reference/main-screen-reference.png` (2030 × 1181) is what the main game screen must look like.
When in doubt, open the image and match it. Do not reinterpret it, do not "improve" it, do not rebuild it out of CSS boxes.

Earlier hand-drawn canvas sketches were rejected and removed. Do not procedurally draw buildings, trees or UI.

**Good news:** the current town already works this way. `src/components/town/TownScene.tsx` renders one image
(`public/assets/town-valley-v2.png`) with five percentage-positioned hotspot buttons. The job is to swap in this image,
fix the aspect ratio handling (no stretching), move the hotspots to the table below, and restyle the HUD and controls that
sit on top. Building ids in code are `bank`, `office`, `hospital` (Health House), `home`, `market`.

---

## 1. How we get the look: use the image as the actual background

We cannot hand-draw this quality in a hackathon. We ship the image.

1. The town screen renders `main-screen-reference.png` as the full background of the game viewport.
2. Live UI (HUD, bottom controls, name plaques if needed, event badges) is **HTML positioned on top of the image**, styled
   to match the parchment and wood already in the picture. The HTML HUD sits exactly over the baked-in HUD strip and
   exactly over the baked-in bottom panel, so it covers them.
3. Buildings are **invisible hotspots** over the image (see the coordinate table). Hover = cursor pointer plus a soft
   highlight; click = open that building's panel. Nothing is redrawn.
4. The other screens (title, reveal) get their own generated images in the same style (section 6) with HTML on top.

### Fitting the screen, no stretching
- Keep the image's aspect ratio (2030:1181 ≈ 1.72:1). `object-fit: contain`, centred.
- Side/top filler when the window is wider or taller: a solid `#96c450` (the grass green sampled from the image) with a
  very faint 2-colour checker (`#96c450` / `#8fbd4a`, 16 px cells) so it reads as more lawn, not as bars. If there is time,
  generate a seamless grass-with-tufts tile in the same style and use that instead.
- `image-rendering: pixelated` on the image element so scaling stays crisp. Do not blur, do not filter.
- Laptop first. The layout must look right at 1440×900 and 1920×1080. Phones are not a target for this screen.

### Suggested DOM shape
```
<div class="town-stage">              /* position: relative; width/height = fitted image box, centred */
  <img class="town-bg" src="/art/main-screen-reference.png">
  <button class="hotspot" data-building="bank"      style="left:7.4%; top:9%;  width:22.2%; height:31.6%">
  ... one per building ...
  <header class="hud"> ... </header>  /* absolutely positioned over the baked HUD strip */
  <footer class="controls"> ... </footer>
</div>
```
Everything inside the stage is positioned in **percentages of the image box**, so it stays aligned at every window size.

---

## 2. Hotspot map (percent of image width/height)

Measured on the reference. Boxes include the name plaque under each building.

| Building id (store) | Label on screen | left | top | width | height |
|---|---|---|---|---|---|
| `bank`      | Pine Bank    | 7.4%  | 9.0%  | 22.2% | 31.6% |
| `office`    | Town Office  | 38.0% | 6.4%  | 22.7% | 28.0% |
| `hospital`  | Health House | 68.0% | 10.6% | 23.6% | 30.0% |
| `home`      | Your Home    | 19.7% | 52.5% | 23.6% | 29.0% |
| `market`    | Market Hall  | 56.2% | 52.5% | 28.6% | 31.0% |

Other landmarks, for badges and effects:

| Thing | center x | center y |
|---|---|---|
| Fountain | 49.3% | 48.7% |
| Lamp post | 34.7% | 43.0% |
| Bench | 71.5% | 45.5% |
| Baked HUD strip | full width | 1.3% to 8.5% |
| Baked bottom panel | 32.7% to 67.0% | 88.5% to 95.5% |

Hover treatment: `filter: brightness(1.08)` is **not** possible on part of an image, so use an overlay: a `::after` on the
hotspot with `box-shadow: inset 0 0 0 3px #f2c23c, 0 0 0 3px #4a311c` at 60% opacity, 4 px rounded corners, and the name
plaque text (if you render it in HTML) turns from `#4a311c` to `#2a1a0e`. Keep it subtle. The image already has plaques; you
may leave them baked and only draw the highlight.

Event badge (Type B decision waiting at a building): a 28 px parchment circle with a 2 px `#4a311c` border and a red
`!` (`#c8372b`), anchored at the hotspot's top-right corner, gentle 2 px bob every 600 ms.

---

## 3. Colours (sampled from the reference, use these exact values)

| Role | Hex |
|---|---|
| Grass | `#96c450` |
| Path | `#e6bd52` |
| Path edge | `#b8933f` |
| River | `#1187e1` (light ripples `#5fb3f0`, foam `#ffffff` at low alpha) |
| Dark outline used on everything | `#4a311c` |
| Parchment (HUD, panels) | `#e6d5a7` |
| Parchment shadow / edge | `#bea87d` |
| Button face | `#c39e5d` |
| Button border | `#4a311c` |
| Primary text | `#4a311c` |
| Secondary label text | `#7a6a4a` |
| Positive money | `#2f7a3a` |
| Negative money / debt | `#b5362a` |
| Gold accent | `#f2c23c` |
| Wood trim | `#ad753a` |
| Roof blue / teal / green / red | `#1e4fa3` / `#17808b` / `#1b6e54` / `#d1493c` |

---

## 4. UI kit: parchment + wood, nothing else

All panels, dialogs, toasts and buttons share one recipe. Put it in `src/components/layout/ui/` as React components
(`PixelPanel`, `PixelButton`, `PixelInput`, `PixelSelect`, `PixelSlider`, `PixelToast`) and nowhere else.

**Panel (`PixelPanel`)**
- Background `#e6d5a7`.
- Border: 2 px solid `#4a311c`, radius 4 px.
- Inner highlight: `box-shadow: inset 0 2px 0 #f3e8c6, inset 0 -3px 0 #bea87d`.
- Drop shadow: `0 4px 0 rgba(74,49,28,.35)`.
- Faint paper grain: an 8 px `repeating-linear-gradient` at 3% opacity, or none. No gradients that look glossy.
- Section header strip: `#ad753a` wood band, 2 px `#4a311c` border below, text `#f3e8c6`.

**Button (`PixelButton`)**
- Face `#c39e5d`, text `#4a311c`, 2 px `#4a311c` border, radius 3 px.
- Pressed: face `#ad8a4a`, translate 1 px down. Primary variant: face `#f2c23c`.
- Disabled: face `#d8c79c`, text `#9a8a66`.
- Height 36 px on desktop, 12 px horizontal padding, never pill-shaped.

**Inputs / sliders**
- Track: 6 px tall `#bea87d` with 2 px `#4a311c` border; thumb: 16 px square, face `#c39e5d`, same border.
- Text inputs: parchment field `#f3e8c6`, 2 px border, no focus glow; focus = border becomes `#f2c23c`.

**Typography**
- Headings and building names: **Pixelify Sans** (Google Fonts), weight 600.
- Body, numbers and labels: **VT323** (Google Fonts). Numbers use `font-variant-numeric: tabular-nums`.
- Both fall back to `ui-monospace, monospace`. Never Inter, never system sans in the game screens.
- Sizes on a 1440 px wide window: HUD labels 14 px, HUD values 20 px, panel body 18 px, panel headings 24 px.

**HUD contents** (left to right, exactly as in the image): small gold coin badge + `FORTUNE VALLEY` over the scenario
name; calendar icon + month/year over `Month n / 24`; Cash; Savings; Debt; Net worth (red when negative); `Timeline ↗`
button at the far right. Under the left end: a small dark-green `OFFLINE READY` tag when the AI provider is unavailable.

**Bottom controls**: `Next month in 00:28` | `Auto on` | `⏸ Pause` | `Next month →` (primary) | `Finish & reveal`.

**Building panels** (Bank, Office, Home, Insurance, Market): a centred `PixelPanel` 720 px wide with a wood header strip
carrying the building name and a `?` help button, body on parchment, decision controls in a bordered inset, projected
consequences in a second inset. Keep the existing panel behaviour and engine wiring; only the skin changes.

---

## 5. What stays where (ownership for the visual pass)

| Who | Does | Does not touch |
|---|---|---|
| Agent 2 (art) | Copies the reference into `public/art/`, builds the stage + background + filler, builds the UI kit above, generates the extra images in section 6 | Store, engine, panel logic, clock |
| Agent 3 (panels) | Re-skins the five panels with the kit, keeps all engine-backed values and tests green | Kit internals, store |
| Agent 4 (flow) | Rebuilds HUD, bottom controls, toasts and event badges as HTML over the stage, wires hotspots to `openBuilding` | Panel contents, engine |
| Agent 5 (title + reveal) | Title screen and reveal screen on their generated backgrounds, using the kit | Town stage |
| Agent 1 (integration) | Merges in this order: kit → stage/HUD → panels → title/reveal; verifies on Vercel | Art decisions |

Branch from current `main`, one small PR each, run typecheck + unit + browser tests before pushing. Update
`tests/town.browser.ts` in the same commit if a dialog or panel changes. Do not delete anyone's tests.

---

## 6. Images still to generate (same style, same tool)

The provided API key works on the image endpoint. Generate at 2030×1181 (or larger, same ratio), then review against the
reference side by side before committing. Save under `public/art/`. Reuse this stem in every prompt so the style holds:

> Warm, polished pixel-art, 16-bit farm-game style, slightly rustic, soft warm palette, thick dark outlines, clean
> readable shapes, no text, no UI, no watermark, same style as a cozy top-down village scene with parchment-coloured
> wooden houses, bright green grass, tan dirt paths.

1. **Title background** (`title-bg.png`): "…wide landscape view of a small valley at golden hour, snow-capped pixel
   mountains with light haze behind, pine forest line, open grassy meadow with a winding dirt path, a few of the same
   cottages, a red barn and wheat field, a pond, large empty sky area in the upper middle." The HTML title sign
   (hanging wooden board, `FORTUNE VALLEY`, green vine leaves along the top and sides) and the three wooden buttons
   (`Play a story`, `Custom story`, `Options`) go on top in HTML using the kit. Buttons in a horizontal row at the bottom.
2. **Reveal background** (`reveal-bg.png`): "…the same village seen from a hill at dusk, fireflies, space in the centre
   for a large parchment panel." The fan chart and histogram render inside a `PixelPanel` on top.
3. **Seamless grass tile** (`grass-tile.png`, 256×256): "…seamless tileable bright green pixel grass with small darker
   tufts and the occasional tiny white flower." Used as filler beside the town image on wide screens.

If the generator adds text or UI, crop or regenerate. Never ship an image with baked text other than the reference itself.

---

## 7. Done means

- Town screen at 1440×900 is visually indistinguishable from the reference except for the live HUD values.
- No stretching at 1920×1080; the extra width shows grass filler, not black bars.
- Hovering each building highlights it; clicking opens the right panel; the event badge appears on the right building.
- HUD, bottom controls, toasts and all five panels use only the kit components and the colour table above.
- Title and reveal screens use their generated backgrounds and the same kit; nothing on them is plain CSS boxes.
- All existing tests pass; screenshots in `docs/screenshots/` regenerated from a passing browser run.
