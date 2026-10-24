# Agent 2 — Art assets and the shared UI kit

Branch name: `agent2-art-kit`. Read `docs/art-reference/ART_DIRECTION.md` first. The reference image there is the target.

## What you own
`public/art/**`, `src/components/layout/ui/**` (new), `src/styles/pixel-tokens.css`, `src/components/layout/PixelArt.tsx`,
`docs/art-reference/**`, `docs/TOWN_HANDOFF.md`.

You do not touch: panels, store, engine, clock, `App.tsx`, `TownScene.tsx`, landing or reveal components. Those agents
import your kit; you do not restyle their files for them.

## Context you need

- Fonts are already bundled: `@fontsource/pixelify-sans` (400, 700) and `@fontsource/vt323`, imported in
  `src/styles/index.css`. No network fonts. Headings use Pixelify Sans, body and numbers VT323.
- `src/styles/pixel-tokens.css` defines `--ft-*` colour tokens and `--pixel` (4 px). Other agents reference these tokens.
  You may change values; do not rename tokens without telling the team in your PR.
- `src/components/layout/PixelArt.tsx` exports `PixelIcon` (kinds used by the HUD: default, `calendar`, `coin`, `leaf`,
  `book`) and `WorldBackdrop` (the ambient landscape behind the game shell). Keep the exports and props; restyle freely.
- The town today draws `public/assets/town-valley-v2.png` inside `TownScene` with percentage hotspots. Agent 4 will switch
  that to your `public/art/town.png` and the hotspot table in the art direction doc. You supply the file; Agent 4 wires it.
- Existing CSS classes other agents use and will keep using until the kit lands: `.pixel-panel`, `.pixel-button`,
  `.pixel-button--gold`, `.text-button`, `.icon-button`, `.offline-tag`, `.eyebrow`. Your kit components may render these
  class names internally so old call sites look right immediately.
- The image API key works on Luminal's image endpoint (`images.luminal.cloud`). Ask the humans for the key and endpoint
  docs; do not commit it. If it fails, see the fallback in task 3.

## Tasks, in order

### 1. Reference image into the build (first hour, small PR)
- Copy `docs/art-reference/main-screen-reference.png` to `public/art/town.png` (keep full 2030×1181). Add
  `public/art/README.md` listing every file, its source (reference or generated prompt), and dimensions.
- Export the hotspot table from `ART_DIRECTION.md` as code: `src/components/layout/ui/townMap.ts` exporting
  `TOWN_IMAGE = '/art/town.png'`, `TOWN_ASPECT = 2030 / 1181`, and `TOWN_HOTSPOTS: Record<BuildingId, { left, top, width, height }>`
  in percentages (ids are `bank`, `office`, `hospital`, `home`, `market`; `hospital` is the Health House). Agent 4 imports this.

### 2. Kit API PR (within two hours; styling can be basic, the API must be final)
Create `src/components/layout/ui/` with `index.ts` re-exporting:

```ts
PixelPanel   ({ title?: ReactNode; headerRight?: ReactNode; variant?: 'parchment' | 'wood' | 'scroll'; padding?: 'sm' | 'md'; className?; children })
PixelButton  ({ variant?: 'default' | 'primary' | 'text'; size?: 'sm' | 'md'; icon?: ReactNode; disabled?; onClick?; type?; 'aria-*' pass-through; children })
PixelInput   ({ label: string; value; onChange(value: string); type?: 'text' | 'number'; prefix?: string; suffix?: string; min?; max?; step?; error?: string; hint?: string; id? })
PixelSelect  ({ label: string; value; onChange(value: string); options: { value: string; label: string; description?: string }[]; error?; id? })
PixelSlider  ({ label: string; value: number; onChange(value: number); min; max; step?; format?(v: number): string; marks?: number[]; id? })
PixelToast   ({ kind: 'info' | 'decision' | 'warning' | 'success'; title: string; detail?: string; action?: { label: string; onClick(): void }; onDismiss?(): void })
PixelTag     ({ tone?: 'neutral' | 'good' | 'bad' | 'warn'; children })
PixelDialogFrame ({ title: string; eyebrow?: string; onClose(): void; width?: 'md' | 'lg' | 'full'; children })  // visual frame only; PanelHost keeps the <dialog> logic
```
- Every component is a plain function component, forwards `className`, uses semantic elements (`button`, `label` + input,
  `input[type=range]`), has visible focus (2 px `#f2c23c` outline offset 2 px), and respects `prefers-reduced-motion`.
- Styles live in `src/components/layout/ui/ui.css`, imported once from `index.ts`. Colours only from the table in
  `ART_DIRECTION.md`; put them in `pixel-tokens.css` as `--ft-parch`, `--ft-parch-shade`, `--ft-outline`, `--ft-button`,
  `--ft-wood`, `--ft-gold`, `--ft-ink`, `--ft-ink-soft`, `--ft-pos`, `--ft-neg`.
- Write `src/components/layout/ui/ui.test.tsx` (Vitest + Testing Library): renders each component, label association for
  inputs, `PixelSlider` calls `onChange` with a number, `PixelToast` action fires, `PixelButton disabled` does not fire.
- Add a dev gallery route: `?dev=ui` in `App.tsx` is Agent 4's file, so instead export `UiGallery` from the kit and ask
  Agent 4 to add the one-line route; until then view it via a Vitest snapshot or a temporary local page you do not commit.
- Document every prop in `docs/TOWN_HANDOFF.md` under "UI kit".

### 3. Generated images (after the kit API is merged)
Use the prompts in `ART_DIRECTION.md` section 6 with the image API. Produce, review side by side with the reference, then commit:
- `public/art/title-bg.png` (2030×1181): valley at golden hour, mountains with haze, pine line, meadow, no text, no UI.
- `public/art/reveal-bg.png` (2030×1181): village from a hill at dusk, empty centre.
- `public/art/grass-tile.png` (256×256, seamless).
- Optional if time: `public/art/scroll-bg.png` parchment texture for `variant="scroll"`.
Reject any output with baked text, watermark, or a different outline weight than the reference. Regenerate rather than edit.
Save each prompt as `public/art/<name>.prompt.md`.

**Fallback if the image API is unavailable:** title-bg = the reference image's top 60% blurred 0 px and darkened 10% is
not acceptable; instead crop the reference's sky-less field and extend with the grass tile, and tell Agent 5 to lean on the
HTML sign and buttons. Say clearly in the PR that the title background is a stand-in.

### 4. Kit polish (parallel with images)
- Pressed and hover states, 1 px drop shadows in `#4a311c` at 35%, parchment grain at 3%, wood grain lines on `variant="wood"`.
- `PixelDialogFrame width="lg"` is 720 px, `full` is 94 vw; Agent 3 and Agent 5 will use these.
- `PixelToast kind="decision"` gets a gold left band and a bobbing `!` badge; Agent 4 uses it for Type B decisions.
- Check every component at 1440×900 and 1920×1080 on the parchment background and on the town image background.

### 5. PixelArt icons
- Redraw `PixelIcon` kinds as 16×16 outlined pixel icons matching the HUD in the reference (coin, calendar, leaf, book, plus
  new `clock`, `scale`, `alert`). Keep the component signature.

## Rules
- Nothing you ship may blur or smooth pixel art: `image-rendering: pixelated` on every image element you add.
- No new npm dependencies without Agent 1's OK.
- Browser test: add one check to `tests/town.browser.ts` that the town image loads (`img[src="/art/town.png"]` natural
  width > 0) once Agent 4 switches to it; coordinate the exact line with Agent 4 to avoid a conflict.

## Acceptance
- `public/art/town.png` and `townMap.ts` merged in the first PR.
- Kit API merged with tests; props documented; other agents import from `@/components/layout/ui`.
- Three generated images committed with prompts, or an explicit stand-in note.
- `npm run typecheck && npm test && npm run test:browser` green on your branch before each push.
