# Manual QA log

Session: 2026-10-24, Chromium, local Vite server, `agent4-human` based on
`origin/agent5-integrate`.

Viewports exercised: 1440×900 and 1280×720. A 24-month Entry-Level Worker run
was advanced at both sizes. QA used the visible UI; forced clicks were used only
after a normal click had reproducibly failed, to determine whether later screens
could be reached.

## Findings

### Story picker · cards overlap and intercept clicks

- Steps: Open the title screen → New Story → try to click Entry-Level Worker at
  1440×900 or 1280×720.
- Expected: Four readable cards with independent clickable areas; clicking any
  visible point in a card starts that story.
- Actual: Card text and portraits overlap adjacent cards. A portrait from another
  card intercepts the pointer over Entry-Level Worker, so Chromium repeatedly
  refuses the click. Keyboard activation still needs a separate pass.
- Screenshots:
  [1440×900](qa/story-picker-1440x900.png),
  [1280×720](qa/story-picker-1280x720.png).

### Natural completion · Review your story is obscured by the HUD

- Steps: Start Entry-Level Worker → advance through month 24 → try to activate
  Review your story.
- Expected: A centered completion card remains above the world and HUD, and its
  button opens the results screen.
- Actual: The completion control resolves underneath the top HUD; the HUD
  intercepts pointer input. In a follow-up forced-click pass, the results screen
  still did not appear. The game remains on the finished town with time controls
  disabled.
- Screenshots:
  [1440×900](qa/month-24-1440x900.png),
  [1280×720](qa/month-24-1280x720.png).

### Browser smoke helpers · tests do not enter the new story picker

- Steps: Run
  `npx playwright test tests/title.browser.ts tests/town.browser.ts --project=desktop`.
- Expected: Shared `startStory` helper opens New Story, chooses an archetype and
  enters the town.
- Actual: Three tests time out on the story picker. Their helper searches for an
  archetype directly from the main menu and does not first activate New Story.
  Five other title tests pass. This is test infrastructure drift, separate from
  the overlapping-card input defect above.
- Screenshot path: Playwright snapshots are under `test-results/` and are not
  committed.

### Bank window · lower content is cramped at 1280×720

- Steps: Start Entry-Level Worker at 1280×720 → open Pine Bank.
- Expected: The window and its scroll affordance clearly fit between HUD and
  control bar.
- Actual: The window reaches behind the bottom control bar and its lower content
  is visually clipped/cramped; the internal scrolling affordance is not obvious.
- Screenshot: [1280×720](qa/bank-1280x720.png).

## Screens reviewed without a new functional defect

- Title screen:
  [1440×900](qa/title-1440x900.png),
  [1280×720](qa/title-1280x720.png).
- Town and first coach mark:
  [1440×900](qa/town-1440x900.png),
  [1280×720](qa/town-1280x720.png).
- Pause menu:
  [1440×900](qa/pause-1440x900.png),
  [1280×720](qa/pause-1280x720.png).
- Options:
  [1440×900](qa/options-1440x900.png),
  [1280×720](qa/options-1280x720.png).

## Blocked coverage

The natural-completion defect blocked results, what-if dropdowns and Play Again.
The story-card pointer defect also made an unmodified end-to-end pass impossible.
Those paths must be rerun after the two blockers are fixed. Timeline, activity,
all five building windows, event decisions and Continue should be repeated in the
same follow-up because the current shared browser helper is stale.
