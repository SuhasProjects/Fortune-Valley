import { test, expect, type Locator, type Page } from '@playwright/test'
import { expectReveal, openTitle, startStory } from './helpers'

// OWNER: mobile-pass. Phone-friendliness beyond Brief M's layout check: no horizontal overflow on any screen, thumb-sized
// targets (44 CSS px) under a coarse pointer, 16 px text boxes (no page zoom), a finger-draggable bank slider, the
// reveal's dropdowns, the coach's question box above the keyboard, and a landscape-phone layout. Mobile project only.

const stubAi = (page: Page) => page.route('**/api/ai', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"disabled"}' }))
const viewport = (page: Page) => page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, sw: document.documentElement.scrollWidth }))

/** The screen does not scroll sideways and none of the named containers sticks out of the viewport. */
async function expectNoOverflow(page: Page, screen: string) {
  const { w, sw } = await viewport(page)
  expect(sw, `${screen}: document scrollWidth`).toBeLessThanOrEqual(w)
  const out = await page.evaluate(() => {
    const names = ['.fv-title-content', '.fv-title-menu', '.fv-title-corners', '.fv-hud', '.fv-control-bar', '.fv-window', '.fv-reveal-ledger', '.fv-toasts', '.fv-coach-tip', '.fv-flow-tools']
    return names.flatMap(name => Array.from(document.querySelectorAll<HTMLElement>(name)).map(el => ({ name, r: el.getBoundingClientRect() })))
      .filter(({ r }) => r.width > 0 && (r.left < -0.5 || r.right > window.innerWidth + 0.5)).map(({ name, r }) => `${name} ${Math.round(r.left)}..${Math.round(r.right)}`)
  })
  expect(out, `${screen}: containers inside the viewport`).toEqual([])
}

/** Every visible button and tab (buildings aside: the world is art) is at least 44 px tall; text boxes are 16 px. */
async function expectTouchSizes(page: Page, screen: string) {
  const bad = await page.evaluate(() => {
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('button, [role=tab], input, select, textarea')) {
      if (el.closest('.fv-building') || el.classList.contains('fv-building')) continue
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue
      const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? el.id
      const type = (el as HTMLInputElement).type
      if (type === 'radio' || type === 'checkbox') continue // plan cards: the whole card is the target
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'tab') { if (r.height < 44) out.push(`${name}: ${Math.round(r.height)} px tall`) }
      else if (type !== 'range') { if (parseFloat(cs.fontSize) < 16) out.push(`${name}: ${cs.fontSize} text`); if (r.height < 44) out.push(`${name}: ${Math.round(r.height)} px tall`) }
      else if (r.height < 44) out.push(`${name}: ${Math.round(r.height)} px slider`)
    }
    return out
  })
  expect(bad, `${screen}: touch targets`).toEqual([])
}

async function expectInside(page: Page, locator: Locator, what: string) {
  const { w, h } = await viewport(page)
  const box = (await locator.boundingBox())!
  expect(box, `${what} has a box`).not.toBeNull()
  expect(box.x, `${what} left`).toBeGreaterThanOrEqual(0)
  expect(box.y, `${what} top`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `${what} right`).toBeLessThanOrEqual(w + 0.5)
  expect(box.y + box.height, `${what} bottom`).toBeLessThanOrEqual(h + 0.5)
  return box
}

const closePanel = (page: Page) => page.getByRole('button', { name: 'Close panel' }).click()
const dismissTips = async (page: Page) => { const tip = page.getByRole('button', { name: /Next tip|Got it/ }); for (let i = 0; i < 3; i++) if (await tip.isVisible().catch(() => false)) await tip.click() }

test.describe('Phone pass', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'phone layout runs on the mobile project only')
    await stubAi(page)
  })

  for (const size of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    test(`${size.width}x${size.height}: no sideways overflow, 44 px targets and a visible control bar on every screen`, async ({ page }) => {
      await page.setViewportSize(size)
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await openTitle(page)
      await expectNoOverflow(page, 'title'); await expectTouchSizes(page, 'title')
      await page.getByRole('button', { name: 'New Story', exact: true }).click()
      await expectNoOverflow(page, 'picker'); await expectTouchSizes(page, 'picker')
      await page.getByRole('button', { name: 'Back' }).click()
      await page.getByRole('button', { name: 'Custom Story' }).click()
      await page.locator('.fv-letter-numbers summary').click()
      await expectNoOverflow(page, 'letter'); await expectTouchSizes(page, 'letter')
      await page.getByRole('button', { name: 'Back' }).click()
      await startStory(page, 'College Student')
      await expectNoOverflow(page, 'town (tips)'); await expectTouchSizes(page, 'town (tips)')
      await dismissTips(page)

      const bar = page.getByRole('group', { name: 'Time controls' })
      const barBox = await expectInside(page, bar, 'control bar')
      for (const button of await bar.getByRole('button').all()) await expectInside(page, button, 'control bar button')
      // Thumb zone: the bar sits in the bottom quarter of the screen.
      expect(barBox.y).toBeGreaterThan(size.height * 0.75)
      const coach = page.getByRole('button', { name: 'Ask the Sage' })
      const coachBox = await expectInside(page, coach, 'coach bubble')
      expect(coachBox.width).toBeGreaterThanOrEqual(44); expect(coachBox.height).toBeGreaterThanOrEqual(44)

      for (const name of ['Pine Bank', 'Town Office', 'Health House', 'Your Home', 'Market Hall']) {
        await page.getByRole('button', { name: new RegExp(`^Open ${name}:`) }).click()
        const dialog = page.getByRole('dialog', { name })
        await expect(dialog).toBeVisible()
        await expectNoOverflow(page, name); await expectTouchSizes(page, name)
        const window = dialog.locator('.fv-window')
        const box = await expectInside(page, window, `${name} window`)
        expect(box.y + box.height, `${name} window stays above the control bar`).toBeLessThanOrEqual(barBox.y)
        await expectInside(page, page.getByRole('button', { name: 'Close panel' }), `${name} close button`)
        await closePanel(page)
      }
      await page.getByRole('button', { name: 'Timeline' }).click()
      await expect(page.getByRole('dialog', { name: 'Your timeline' })).toBeVisible()
      await expectNoOverflow(page, 'timeline'); await expectTouchSizes(page, 'timeline')
      await closePanel(page)
      await page.getByRole('button', { name: 'Pause menu' }).click()
      await expectNoOverflow(page, 'pause'); await expectTouchSizes(page, 'pause')
      await page.getByRole('button', { name: 'Options' }).click()
      await expectNoOverflow(page, 'options'); await expectTouchSizes(page, 'options')
      await closePanel(page)
      await page.getByRole('button', { name: 'Guide' }).click()
      await expectNoOverflow(page, 'guide'); await expectTouchSizes(page, 'guide')
      await closePanel(page)
      await page.getByRole('button', { name: 'Resume', exact: true }).click()

      // Toasts stay in the strip under the HUD and never reach the control bar.
      for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Next month/ }).click()
      const toasts = page.getByRole('region', { name: 'Recent financial activity' })
      await expect(toasts.locator('.fv-toast').first()).toBeVisible()
      const toastBox = await expectInside(page, toasts, 'toast stack')
      expect(toastBox.y + toastBox.height).toBeLessThan(barBox.y)
      await expectNoOverflow(page, 'toasts'); await expectTouchSizes(page, 'toasts')

      await page.getByRole('button', { name: /Finish & reveal/ }).click()
      await expectReveal(page)
      await expectNoOverflow(page, 'reveal')
    })
  }

  test('bank slider is a 44 px hit box a finger can drag; text boxes are 16 px', async ({ page }) => {
    await openTitle(page)
    await startStory(page, 'Entry-Level Worker')
    await dismissTips(page)
    await page.getByRole('button', { name: /Open Pine Bank:/ }).click()
    const bank = page.getByRole('dialog', { name: 'Pine Bank' })
    const slider = bank.getByRole('slider', { name: 'Monthly savings contribution slider' })
    const input = bank.getByLabel('Monthly savings contribution (USD)', { exact: true })
    expect(parseFloat(await input.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    await slider.scrollIntoViewIfNeeded()
    const box = (await slider.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    const before = Number(await slider.getAttribute('aria-valuenow'))
    // A tap lands on the track (touch), then a drag from the thumb to the right end (pointer).
    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2)
    const tapped = Number(await slider.getAttribute('aria-valuenow'))
    expect(tapped).toBeGreaterThan(before)
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 6 })
    await page.mouse.up()
    const max = Number(await slider.getAttribute('aria-valuemax'))
    expect(Number(await slider.getAttribute('aria-valuenow'))).toBe(max)
    await expect(input).toHaveValue(String(max))
  })

  test('reveal: charts and tiles stack in one column and the what-if dropdowns open with 44 px options', async ({ page }) => {
    await openTitle(page)
    await startStory(page, 'Entry-Level Worker')
    await dismissTips(page)
    await page.getByRole('button', { name: /Open Pine Bank:/ }).click()
    await page.getByLabel('Monthly savings contribution (USD)', { exact: true }).fill('300')
    await page.getByRole('button', { name: 'Save savings contribution', exact: true }).click()
    await closePanel(page)
    await page.getByRole('button', { name: /Next month/ }).click()
    await page.getByRole('button', { name: /Finish & reveal/ }).click()
    await expectReveal(page)
    const { w } = await viewport(page)
    const decision = page.getByRole('combobox', { name: 'Pick a decision' })
    await decision.scrollIntoViewIfNeeded()
    const decisionBox = (await decision.boundingBox())!
    expect(decisionBox.height).toBeGreaterThanOrEqual(44)
    expect(decisionBox.x + decisionBox.width).toBeLessThanOrEqual(w)
    await decision.click()
    const list = page.getByRole('listbox')
    await expect(list).toBeVisible()
    const options = list.getByRole('option')
    expect(await options.count()).toBeGreaterThan(0)
    for (const option of await options.all()) expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    const listBox = (await list.boundingBox())!
    expect(listBox.x + listBox.width).toBeLessThanOrEqual(w)
    const chosen = (await options.last().textContent())!.trim()
    await options.last().click()
    await expect(list).toHaveCount(0)
    await expect(decision).toContainText(chosen)
    // The two comparison charts stack (same left edge) and each fits the screen; so do the change tiles.
    const charts = page.locator('.fv-comparison-charts .fv-outcome-chart')
    await expect(charts).toHaveCount(2, { timeout: 15_000 })
    const [a, b] = await Promise.all([charts.nth(0).boundingBox(), charts.nth(1).boundingBox()])
    expect(Math.round(a!.x)).toBe(Math.round(b!.x))
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1)
    expect(a!.x + a!.width).toBeLessThanOrEqual(w)
    const tiles = page.locator('.fv-change-tiles > *')
    await expect(tiles.first()).toBeVisible()
    const tileBoxes = await Promise.all((await tiles.all()).map(tile => tile.boundingBox()))
    for (const tile of tileBoxes) { expect(Math.round(tile!.x)).toBe(Math.round(tileBoxes[0]!.x)); expect(tile!.x + tile!.width).toBeLessThanOrEqual(w) }
    await expectNoOverflow(page, 'reveal (what-if)')
  })

  test('coach sheet: the question box stays visible above the control bar, also when the viewport shrinks for a keyboard', async ({ page }) => {
    await openTitle(page)
    await startStory(page, 'College Student')
    await dismissTips(page)
    await page.getByRole('button', { name: 'Ask the Sage' }).click()
    const input = page.locator('#fv-coach-input')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    expect(parseFloat(await input.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    const bar = page.getByRole('group', { name: 'Time controls' })
    let inputBox = await expectInside(page, input, 'coach input')
    let barBox = (await bar.boundingBox())!
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(barBox.y)
    for (const chip of await page.getByRole('button', { name: /save more|card or save|insurance do/ }).all()) await expectInside(page, chip, 'coach chip')
    // Android resizes the layout viewport for the keyboard (interactive-widget=resizes-content): the sheet shrinks and
    // the question box stays on screen.
    await page.setViewportSize({ width: 390, height: 500 })
    inputBox = await expectInside(page, input, 'coach input (keyboard)')
    barBox = (await bar.boundingBox())!
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(barBox.y)
    await expect(page.getByRole('dialog', { name: 'The Sage' }).getByRole('heading', { name: 'The Sage' })).toBeVisible()
    await expectNoOverflow(page, 'coach (keyboard)')
  })

  test('landscape phone (844x390): one-row HUD and bar, buildings tappable, windows full height, coach reachable', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await openTitle(page)
    await expectNoOverflow(page, 'title (landscape)')
    await startStory(page, 'College Student')
    await expectNoOverflow(page, 'town (landscape)')
    const tip = page.getByRole('button', { name: /Next tip|Got it/ })
    await expectInside(page, tip, 'coach tip button')
    await dismissTips(page)
    const hud = page.getByRole('region', { name: 'Financial overview' })
    const bar = page.getByRole('group', { name: 'Time controls' })
    const hudBox = await expectInside(page, hud, 'HUD')
    const barBox = await expectInside(page, bar, 'control bar')
    expect(hudBox.height).toBeLessThanOrEqual(60)
    for (const button of await bar.getByRole('button').all()) { const b = await expectInside(page, button, 'bar button'); expect(b.height).toBeGreaterThanOrEqual(44) }
    for (const cell of ['Cash', 'Savings', 'Debt', 'Net worth']) await expect(hud.getByText(cell, { exact: true })).toBeVisible()
    for (const name of ['Pine Bank', 'Town Office', 'Health House', 'Your Home', 'Market Hall']) {
      const button = page.getByRole('button', { name: new RegExp(`^Open ${name}:`) })
      const box = (await button.boundingBox())!
      expect(box.y + box.height * 0.6, `${name} body below the HUD`).toBeGreaterThan(hudBox.y + hudBox.height)
      expect(box.y + box.height * 0.4, `${name} body above the bar`).toBeLessThan(barBox.y)
    }
    await page.getByRole('button', { name: /^Open Pine Bank:/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Pine Bank' })
    await expect(dialog).toBeVisible()
    const windowBox = await expectInside(page, dialog.locator('.fv-window'), 'bank window')
    expect(windowBox.height).toBeGreaterThan(300) // the full height, not the HUD-to-bar gap
    await expect(dialog.getByRole('heading', { name: 'Pine Bank' })).toBeVisible()
    await expectTouchSizes(page, 'bank (landscape)')
    await closePanel(page)
    const coach = page.getByRole('button', { name: 'Ask the Sage' })
    const coachBox = await expectInside(page, coach, 'coach bubble')
    expect(coachBox.height).toBeGreaterThanOrEqual(44)
    await coach.click()
    await expectInside(page, page.locator('#fv-coach-input'), 'coach input (landscape)')
    await closePanel(page)
    await page.getByRole('button', { name: 'Pause menu' }).click()
    await expectTouchSizes(page, 'pause (landscape)')
    await page.getByRole('button', { name: 'Resume', exact: true }).click()
    await page.getByRole('button', { name: /Finish & reveal/ }).click()
    await expectReveal(page)
    await expectNoOverflow(page, 'reveal (landscape)')
  })
})
