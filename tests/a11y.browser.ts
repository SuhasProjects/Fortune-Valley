import { test, expect, type Page } from '@playwright/test'
import { expectReveal, openTitle, startStory } from './helpers'

// OWNER: Agent 1 (perf/a11y). Keyboard reachability, visible focus and a clean console across the whole flow.

const focused = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement | null
  if (!el) return { name: '', visible: false }
  const cs = getComputedStyle(el)
  const hoverFrame = el.querySelector<HTMLElement>('.fv-building__hover')
  const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
  const frame = !!hoverFrame && getComputedStyle(hoverFrame).display !== 'none'
  return { name: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '', visible: ring || frame, building: el.getAttribute('data-building') }
})

test('keyboard reaches title, buildings, windows and the ending with visible focus and no console errors', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'keyboard flow is a laptop concern')
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/503/.test(m.text())) errors.push(m.text()) }) // the stubbed AI route answers 503 on purpose
  await page.route('**/api/ai', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"disabled"}' }))

  await openTitle(page)
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en')
  await expect(page).toHaveTitle(/Fortune Valley/)
  await page.keyboard.press('Tab')
  const first = await focused(page)
  expect(first.visible, `first focus (${first.name}) shows a ring`).toBe(true)
  await page.getByRole('button', { name: 'New Story', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /College Student/ }).focus()
  expect((await focused(page)).visible).toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /Open Pine Bank:/ })).toBeVisible()
  const tip = page.getByRole('button', { name: /Next tip|Got it/ })
  for (let i = 0; i < 3; i++) if (await tip.isVisible().catch(() => false)) await tip.click()

  // Buildings in order, each with a visible focus treatment (gold hover frame).
  await page.getByRole('button', { name: /Open Pine Bank:/ }).focus()
  const order: string[] = []
  for (let i = 0; i < 5; i++) {
    const f = await focused(page)
    expect(f.visible, `building focus visible (${f.name})`).toBe(true)
    order.push(f.building ?? '')
    await page.keyboard.press('Tab')
  }
  expect(order).toEqual(['bank', 'office', 'hospital', 'home', 'market'])

  // Open a window by keyboard, Escape closes it and focus returns to the opener.
  await page.getByRole('button', { name: /Open Pine Bank:/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Pine Bank' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Pine Bank' })).toHaveCount(0)
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-building'))).toBe('bank')

  // The Coach (Sage) bubble is reachable by keyboard: Enter opens the chat (focus lands in the question box), the three
  // suggested chips are there, a chip gets an (offline) answer, Escape closes and focus returns to the bubble.
  const coach = page.getByRole('button', { name: 'Ask the Sage' })
  await coach.focus()
  expect((await focused(page)).visible, 'coach bubble focus visible').toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'The Sage' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Your question' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Pay the card or save?' })).toBeVisible()
  await page.getByRole('button', { name: 'Pay the card or save?' }).click()
  await expect(page.getByRole('dialog', { name: 'The Sage' }).getByText(/savings earn/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'The Sage' })).toHaveCount(0)
  await expect(coach).toBeFocused()

  // HUD and control bar are reachable and show focus.
  for (const name of [/Timeline/, /Next month/, /Finish & reveal/]) {
    await page.getByRole('button', { name }).focus()
    expect((await focused(page)).visible, `${name} focus visible`).toBe(true)
  }
  await page.getByRole('button', { name: /Next month/ }).press('Enter')
  await page.getByRole('button', { name: /Finish & reveal/ }).press('Enter')
  await page.getByRole('button', { name: 'Finish now' }).press('Enter')
  await expectReveal(page)
  await expect(page.getByRole('button', { name: /Choose a new story/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('images declare their size and the page sets language and theme colour', async ({ page }) => {
  await openTitle(page)
  await startStory(page, 'College Student')
  expect(await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).map((i) => i.src))).toEqual([])
  expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBeTruthy()
})
