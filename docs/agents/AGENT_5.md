# Agent 5: title screen, story pickers, custom story, results

Read [README.md](README.md) first (vision, palette, `--px` scale system, materials, contracts, ownership).
Branch: `agent5-title-reveal`.

**Plain English:** you own the first and last thing the player sees. The first screen becomes a proper game title
screen in the spirit of Stardew Valley: a big hanging wooden **"Fortune Valley"** sign wrapped in vines, mountains fading
into a light haze behind a green valley (no clouds), and three chunky wooden buttons: **New Story**, **Custom Story**,
**Continue**. Behind those buttons are the story picker, the "write your own story" letter, and a Guide book that holds the
how-to-play and FAQ text (so the game is first and the website stuff is tucked away). The last screen is the results: the
same town at dusk with a big parchment ledger showing your 1,000 futures in clear, game-styled charts.

---

## 0. What exists now (so you don't need to read it)

- `src/components/landing/Landing.tsx` (102 long lines): a website-style page (`<main class="welcome-page">`): sticky
  header with "Financial Town" brand, nav (`How it works` toggle, `Starting lives`, `The town`, `FAQs`), disabled `Sign in`
  / `Create account`, hero `Small choices. A clearer financial future.` with `TownIllustration` (SVG), benefits strip,
  **saved-game block** (`store.savedGame` → "Continue {title}", calls `store.loadSavedGame()`), play guide (4 steps), five
  building descriptions, month explainer, **starting lives** (buttons per `scenarios` entry → `store.startGame(scenario)`,
  with `.welcome-life-card`), outcomes section, **custom question form** (textarea → `store.generatePersonalized(prompt)` →
  `store.startGame(result.config)`, shows `formError`), FAQ `<details>` (5 Q&As), footer. Styles in `src/styles/welcome.css`.
  This whole page is replaced. Reuse its *copy* (steps, building blurbs, FAQ answers) inside the Guide.
- `src/data/scenarios.ts` (yours): `SCENARIO_ORDER = ['college_student','entry_worker','professional','young_family']`,
  `scenarios: GameConfig[]` (fixed seeds, so **keep starting premade games with these**; the e2e test expects a decision to
  appear by month 3 with those seeds), `scenarioCards` `{id,title,description,focus}`, `freshScenario(id)` (random seed, used
  by Agent 4's "Restart"), `scenarioById`. Titles: College Student, Entry-Level Worker, Professional, Young Family.
- Store calls you need: `startGame(config)`, `savedGame` (`{savedAt,title,monthIndex} | null`), `loadSavedGame()`,
  `generatePersonalized(prompt, numbers?)` → `{config, fallback, warnings}` (throws with a message on empty prompt; sets
  `personalizationLoading`, `personalizationError`), `requestExplanation(question?)`, `resetGame()`, `aiStatus`.
  `PersonalizedInput` numbers: `age, grossAnnualIncome, monthlyRent, savings, debtBalance, debtApr, dependents` (all optional).
- `src/components/reveal/RevealChart.tsx` (130 lines) + `reveal.css` + `RevealChart.test.tsx`: renders from `FinishPayload`:
  hero (`mc.observedNetWorth`, percentile sentence only when `mc.observedHorizonMatches`), heading
  **`Same strategy, 1,000 futures`** (`mc.pathsCompleted.toLocaleString()`), 4 stats (`median`, `p10`–`p90`,
  `probabilityNegativeNetWorth`, `probabilityLiquidityShortfall`), Recharts fan chart (`mc.bands` p10/p90 band, median, observed
  from `finalState.netWorthHistory`), histogram via `histogram(mc.endingNetWorths, 20)` from `@/engine`, comparison
  (`mc.comparison`: `labelA`, `labelB`, `a`/`b` are full summaries **including `bands`**, `pairedMedianDifference`,
  `probabilityAOutperformsB`), `payload.explanation` with source label, table view, assumptions (`mc.assumptionsSummary`,
  seed, replayFallbacks, elapsedMs), and `Choose a new story →` button. Exports `REVEAL_COLORS`. **Never compute statistics in
  the component**; everything comes from `MonteCarloResult` (and `histogram()` for binning).
- Today the reveal is shown inside a `PanelHost` dialog titled `Your next chapter`. From now on Agent 4's router shows your
  full-screen `RevealScreen` instead.
- `tests/helpers.ts` (yours): `openTitle`, `expectOnTitle`, `startStory(page, life)`, `expectReveal`, `leaveReveal`. Every
  other agent's browser tests start games and check the reveal **only** through these helpers. When you change the title or
  reveal, update the helpers in the same commit so everyone's tests keep passing. `tests/title.browser.ts` (yours) holds
  the old landing tests; replace them with title tests as the landing goes away.
- `index.html` (yours): title "Financial Town — Your little world", theme colour, favicon `/assets/favicon.svg`.

---

## 1. Phase 0 (first ~45 min): stub PR

`[agent5] contracts: TitleScreen, RevealScreen, GuideWindow`:
`src/game/title/TitleScreen.tsx` (renders today's `Landing` for now), `src/game/title/GuideWindow.tsx`
(`{ onClose }`, a Modal named `Guide`, used by Agent 4's pause menu), `src/game/reveal/RevealScreen.tsx`
(`{ payload, onPlayAgain }`, renders `RevealChart` inside a full-screen wrapper). Keep helpers passing.

---

## 2. Title screen (`src/game/title/`)

Mount everything inside Agent 1's `GameStage` (`label="Fortune Valley"`) so `--px` scaling matches the game. The
`world` prop is your `TitleScene`; menus go in the UI layer.

**Scene (`TitleScene`, art in `art-src/title/**`, rules in README §5):** a 480×288 art-px composition, centred, edges
extending naturally on wide screens (tile the mountain and meadow layers horizontally).
- Sky: three flat bands `1` → mid → `2` with 2×2 checker dithering between bands. No clouds. No gradients.
- Mountains: three ranges as separate horizontally tileable sprites: far (`3` with `4` snow caps), mid, near (green-grey
  foothills). Ask Agent 1 for any extra palette keys you need (`mountain-mid`, `mountain-near`); keys are added, never changed.
- **Haze:** between each range, a flat band of `2` at ~45% opacity (flat translucent layers are allowed for haze only),
  drifting 1 art px every 600 ms in opposite directions (stepped; frozen under reduced motion).
- Foreground: a pine forest line, a meadow (reuse Agent 1's grass tiles through `Sprite`, or your own), a winding path from
  the bottom, two or three small distant cottages (draw small 24×20 versions in the same style), a few flowers. Optional:
  2 birds crossing the sky every ~10 s (2-frame flap).
- **The sign:** a large hanging wooden board (`art-src/title/sign.txt`, ~200×56 art px: planks `w/b/W`, `k` outline,
  nail pixels, top edge hung by two ropes or chains running off the top of the screen), with **vines clearly visible**:
  separate `vine-top`, `vine-left`, `vine-right` overlays with leaves in `T/t/Y` and a few `5`/`f` blossoms, draping over
  the top edge and trailing down both sides, 2-frame sway. The sign bobs 1 art px every ~1.2 s.
  The words **FORTUNE VALLEY** are live HTML `<h1>` text (Pixelify Sans 700, `calc(14 * var(--px))`, fill `Q`, 1-art-px
  `k` outline via stacked text-shadows, 2-art-px `W` drop shadow), centred on the board. A small plaque under the sign:
  "A little town. A bigger perspective."
- Placement at 1280×720 (scale 4): sign centred, top at ~10% of the height; buttons row at ~70%.

**Menu:** three Agent 2 `Button size="lg"` wood buttons in a horizontal row:
- **New Story** → the story picker (§3).
- **Custom Story** → the letter screen (§4).
- **Continue** → `loadSavedGame()`; shows `Month 6 · College Student` under the label when `savedGame` exists; otherwise
  disabled with tooltip "No saved story yet".
- Corner `IconButton`s: **Options** (gear, bottom-left) → Agent 4's `OptionsWindow`; **Guide** (book, bottom-right) →
  your `GuideWindow`.
- Keyboard: Left/Right moves focus between the three; Enter activates; a small pixel pointer sprite appears beside the
  focused/hovered button (Stardew style). `sfx('click')` from Agent 4.
- Sub-screens (picker, letter) slide in over the same scene; the sign moves up and shrinks to a header **only by switching to
  a smaller sign sprite**, never by CSS-scaling pixel art. `Back` returns to the main menu (Esc too).

---

## 3. Story picker (`StoryPicker`)

- Four wooden signboard cards in a row (2×2 under ~1100 px wide): a 32×32 pixel **portrait** you draw for each life
  (student with backpack, worker with lanyard, professional with tie, parent with child; 2-frame idle blink), the title,
  `scenarioCards[i].description`, and three key facts from the config: yearly salary
  (`config` employment `grossAnnualSalary`), starting cash, and total debt. For totals use engine helpers on a created state
  (`createGame(config)` then `debtTotal(state)` / `netWorthOf(state)` from `@/engine`). **No arithmetic in UI.**
- The card is one `<button>` whose accessible name contains the life title (the helpers use `/College Student/`).
- Click → `startGame(scenarios[i])` (fixed seeds).
- Update `startStory` in `tests/helpers.ts` to click **New Story** first.

---

## 4. Custom story (`CustomStoryLetter`)

- A parchment letter on a wood desk: "Dear Valley, here is my situation…". Field (multiline, max 2,000 chars, counter),
  three example chips that fill the field (e.g. "I'm 24, earn $48k, rent is $1,400 and I have $9k of card debt."), and an
  **Add numbers** collapsible with `NumberField`s for the seven optional `PersonalizedInput` numbers.
- Submit `Write my story` → `generatePersonalized(prompt, numbers)`. While `personalizationLoading`: a quill writing
  animation (3-frame sprite) and "The valley is preparing your story…".
- Result card: `config.title`, the base life it maps to, a `Tag` "Made offline from a template" when `fallback`, any
  `warnings` as a list, then `Start this story` (primary) and `Edit`. Errors show `personalizationError` in the kit error style.

---

## 5. Guide (`GuideWindow`, dialog `Guide`)

Agent 2 `Tabs`: **How to play** (the 4 play steps from the old landing), **The town** (five buildings with
`BuildingPortrait` from Agent 1 and the old one-line blurbs), **Controls** (Agent 4's shortcuts: Space, N, 1–5, T, A, Esc, ?),
**FAQ** (the five Q&As from the old landing, as kit-styled collapsibles), **About** ("Fictional educational simulation.
Assumptions are illustrative. For learning, not personal financial advice."). No sign-in placeholders anywhere.

---

## 6. Results (`src/game/reveal/RevealScreen.tsx`)

- `GameStage` with `world={<TownWorld timeOfDay="dusk"/>}` (no `onBuildingClick`, so it's decorative) and, in the UI layer,
  a large ledger `Board` (about 260×160 art px at scale 4, internal scroll if needed) that drops in over 3 steps.
- Header plaque **Your Next Chapter**. Keep a heading with the text `Same strategy, 1,000 futures` (helpers check it) and
  update `expectReveal` to the new structure (e.g. a `region` named `Simulation results`).
- **Headline:** "You finished month 24 with **$12,340**" (`mc.observedNetWorth`, `Money`), the percentile sentence (only when
  `observedHorizonMatches`, "not a grade" wording kept), four stat tiles with icons.
- **Tabs** (Agent 2): **Futures**, **Spread**, **Your choices vs default**, **Why?**
  - *Futures* (Recharts `ComposedChart`): `stepAfter` lines, no smoothing, no animation, crisp strokes
    (`strokeWidth = px/2`, from `useStageScale()`), VT323 ticks, `P` dashed grid. Band = `--c-leaf` at 30%, median
    `--c-leaf-dark`, your run `--c-gold` with a 1-px `--c-outline` underlay line, zero line dashed `--c-outline`.
    **Hover crosshair:** vertical 1-art-px line + parchment tooltip (month label, 10th–90th, median, yours).
    **Direct labels** at the right end of the median and your line (no legend needed; keep the legend for screen readers).
    **Strategy toggle** (`Your strategy` / `Default policy`) switching the band and median between `comparison.a.bands`
    and `comparison.b.bands` when `mc.comparison` exists (hide the toggle otherwise).
  - *Spread*: histogram of `histogram(mc.endingNetWorths, 20)` as square-cornered bars, your outcome as a gold marker
    labelled `You`.
  - *Your choices vs default*: two horizontal pixel bars for `a.median` and `b.median`, the paired median difference, and
    "In 63% of futures your choices beat the default" from `probabilityAOutperformsB` (format only).
  - *Why?*: `payload.explanation.text` with source tag (`AI explanation` / `Offline explanation (template)`), plus a
    Field "Ask about your results" + `Ask` → `requestExplanation(question)` with a loading state. The answer replaces the
    explanation (that's how the store works).
  - Keep the table view and assumptions as collapsibles at the bottom of *Futures* (accessibility).
- Buttons: primary `Choose a new story` (keep this name; it calls `onPlayAgain`).
- Chart colours must come from palette CSS variables (read them with `getComputedStyle` once and pass them to Recharts),
  so they match the world. Update or replace `REVEAL_COLORS` accordingly; update `RevealChart.test.tsx` (yours).

---

## 7. Cleanup, branding, tests

- `index.html`: title `Fortune Valley`, `theme-color` `#4a311c`, favicon = a 16×16 pixel gold coin you draw
  (`art-src/title/favicon.txt` → `public/art/title/favicon.png`). Delete `public/assets/favicon.svg` once unused.
- Delete `Landing.tsx`, `TownIllustration.tsx`, `welcome.css` (and its import line, which is in Agent 2's `index.css`, so ask
  them, or leave the import to Agent 1's cleanup) and `src/components/reveal/*` once `RevealScreen` no longer imports them.
- `tests/title.browser.ts`: title shows the `Fortune Valley` heading in Pixelify Sans, three menu buttons, Continue disabled
  without a save and enabled with one, keyboard Left/Right/Enter works, Options and Guide open and close, no page scroll at
  1280×720 / 1440×900 / 1920×1080, custom story with `/api/ai` stubbed to 503 produces an offline story and starts it.
- `tests/reveal.browser.ts`: play 2 months, finish, the reveal shows the headline, each tab renders, hovering the fan
  chart shows the crosshair tooltip, strategy toggle switches, `Why?` with stubbed AI shows the offline answer, `Choose a new
  story` returns to the title.
- Unit tests for StoryPicker (four cards, names, starts the fixed-seed config) and the reveal (no NaN, toggle hidden without
  comparison, percentile hidden when horizons differ).

---

## 8. Done checklist

- [ ] Title looks like a game title screen: vines clearly visible on the sign, hazy mountains, no clouds, wood buttons
      with text on wood, no website chrome, crisp at every size.
- [ ] Picker, letter and guide feel in-world and are fully keyboard-usable.
- [ ] Results: dusk town behind a parchment ledger, crosshair, direct labels, strategy toggle, Why? all working; nothing
      computed in UI.
- [ ] Helpers updated so every agent's browser tests pass; old landing and its CSS deleted.
