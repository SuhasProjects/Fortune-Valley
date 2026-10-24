# Agent 2 handoff

The kit exports all agreed components and prop types from `src/ui/index.ts`.
Frames, controls, icons and cursors live in `art-src/ui`; their compiled assets
are committed under `public/art/ui`. The shared palette and art compiler are used.
The optional `Icon.compact` prop selects a separately authored 6px icon instead
of fractionally shrinking the 10px icon. Public 10px and 16px sizes remain available.

## Agent 4: router and HUD placement

```tsx
import { UiGallery } from './ui/dev/UiGallery'
// Replace the existing ?dev=ui placeholder in App:
if (dev === 'ui') return <UiGallery />

import { Hud, ControlBar, StatusTag, HudFooter } from './hud'
// In GameScreen's stage UI layer:
<Hud onOpenTimeline={store.openTimeline} />
<StatusTag />
<HudFooter />
```

`ControlBar` is a drop-in replacement for `GameClock`, with the same props.
Place the components directly in the stage's full-viewport UI layer: they position
themselves in art pixels. Do not wrap them in the legacy HUD/control positioning
containers. Reuse the existing clock hook and callbacks, including `requestFinish`.
Keep the existing pause-menu button and save indicator alongside `StatusTag`.
Reduced motion already reads `useSettings().reduceMotion` and the OS preference.

While that router change is pending, the self-contained gallery is available at
`/src/ui/dev/index.html?scale=4` (scales 3, 4, 6 supported).

## Agents 3 and 5

Use `Modal` for accessible native dialogs, or `Window` for visual frames without
dialog behavior. The modal names itself by its title, contains keyboard focus,
closes on Escape/backdrop click, restores focus and locks body scrolling.
The close button is named `Close panel`. Number fields forward native input props,
including caller-provided `aria-label`. Select/Slider/Toggle callbacks receive values.

`PixelArt.tsx` is gone and `world.css` / `pixel-tokens.css` only keep the legacy classes and
`--ft-*` tokens that panels, flow and charts still reference. Remove the rest when those migrate.

## Validation

Before the latest main rebase: 138 unit tests and six UI browser checks passed.
After rebasing onto Agent 4's game-flow update: typecheck passed, all 108 sprites
compiled with the shared compiler, and the browser smoke confirmed both bundled
fonts load. Full suites were not repeated at the user's request to limit testing.
The HUD browser checks cover the standalone gallery until Agent 4 mounts the kit.

On Windows the shared art script's CLI guard currently skips its entry point;
invoke its exported compiler with:
`node --input-type=module -e "import {compileAll} from './scripts/art/compile.mjs'; compileAll()"`.
Agent 1 owns the CLI guard fix.
