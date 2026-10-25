import { test, expect } from '@playwright/test'
import { expectOnTitle, expectReveal, openTitle, startStory } from './helpers'

// OWNER: Agent 4 (game flow). Keyboard shortcuts, pause menu, options persistence, save & continue, finish sequence.
// Start games only through ./helpers.

test('shortcuts, pause menu, options persist, save & continue, finish early', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/ai', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"disabled"}' }))
  await openTitle(page)
  await startStory(page, 'College Student')
  const blur = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  // N advances a month; Space pauses and resumes.
  await blur()
  await page.keyboard.press('n')
  await expect(page.getByText(/^Month 1 \/ \d+$/)).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: /Next month/ })).toBeDisabled()
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: /Next month/ })).toBeEnabled()

  // 2 opens the Town Office; Esc closes it; Esc again opens the pause menu.
  await page.keyboard.press('2')
  const office = page.getByRole('dialog', { name: 'Town Office' })
  await expect(office).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(office).toHaveCount(0)
  await page.keyboard.press('Escape')
  const paused = page.getByRole('dialog', { name: 'Paused' })
  await expect(paused).toBeVisible()
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible()

  // Options toggles persist across a reload.
  await paused.getByRole('button', { name: 'Options' }).click()
  const options = page.getByRole('dialog', { name: 'Options' })
  await expect(options).toBeVisible()
  const sound = options.getByRole('switch', { name: 'Sound' })
  await expect(sound).toHaveAttribute('aria-checked', 'true')
  await sound.click()
  await expect(sound).toHaveAttribute('aria-checked', 'false')
  await options.getByRole('button', { name: 'Done' }).click()
  await expect(paused).toBeVisible()

  // Save & quit, reload, check the setting, then Continue restores the month.
  await paused.getByRole('button', { name: 'Save & quit to title' }).click()
  await expectOnTitle(page)
  await page.reload()
  await expectOnTitle(page)
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Options' }).getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('dialog', { name: 'Options' }).getByRole('switch', { name: 'Sound' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: /Continue.*Month 1/ }).click()
  await expect(page.getByText(/^Month 1 \/ \d+$/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Next month/ })).toBeEnabled()

  // Finish early: confirm, overlay, reveal.
  await page.getByRole('button', { name: /Finish & reveal/ }).click()
  await expect(page.getByRole('dialog', { name: 'Finish early?' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep playing' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: /Finish & reveal/ }).click()
  await page.getByRole('button', { name: 'Finish now' }).click()
  await expect(page.getByText('Counting 1,000 possible futures…')).toBeVisible()
  await expectReveal(page)
  expect(errors).toEqual([])
})

test('natural completion at month 36 offers Review your story above the HUD and reaches the reveal', async ({ page }) => {
  await page.route('**/api/ai', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"disabled"}' }))
  await openTitle(page)
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await page.getByRole('combobox', { name: 'Auto-advance' }).selectOption('0')
  await page.keyboard.press('Escape')
  await startStory(page, 'College Student')
  await expect(page.getByText('Auto-time off')).toBeVisible()
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  for (let month = 0; month < 36; month++) {
    await page.keyboard.press('n')
    await expect(page.getByText(new RegExp(`^Month ${month + 1} / 36$`))).toBeVisible()
  }
  await expect(page.getByText('STORY COMPLETE', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Next month/ })).toBeDisabled()
  const review = page.getByRole('button', { name: 'Review your story' })
  await expect(review).toBeVisible()
  // The card must sit above the HUD and own its pointer events: a real click, not a forced one.
  expect(await review.evaluate(button => {
    const box = button.getBoundingClientRect()
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('button') === button
  })).toBe(true)
  await review.click()
  await expect(page.getByText('Counting 1,000 possible futures…')).toBeVisible()
  await expectReveal(page)
})

test('timeline and activity journals open by keyboard and decision toasts lead to the building', async ({ page }) => {
  await page.route('**/api/ai', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"disabled"}' }))
  await openTitle(page)
  await startStory(page, 'Entry-Level Worker')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('t')
  const timeline = page.getByRole('dialog', { name: 'Your timeline' })
  await expect(timeline).toBeVisible()
  await timeline.getByRole('tab', { name: 'Choices' }).click()
  await page.keyboard.press('Escape')
  await expect(timeline).toHaveCount(0)
  for (let month = 0; month < 3; month++) await page.keyboard.press('n')
  await expect(page.getByText(/^Month 3 \/ \d+$/)).toBeVisible()
  const toasts = page.getByRole('region', { name: 'Recent financial activity' })
  // No monthly summary toast any more: the recap banner carries the month; toasts are events only.
  await expect(page.getByRole('status', { name: 'Month recap' })).toContainText(/^Month 3 · /)
  await expect(page.getByRole('button', { name: /Decision waiting/ }).first()).toBeVisible()
  const decision = toasts.getByRole('button', { name: /^Go to / })
  await expect(decision).toBeVisible()
  const target = (await decision.textContent())!.replace(/^Go to\s+/, '').trim()
  await decision.click()
  await expect(page.getByRole('dialog', { name: target })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('a')
  const activity = page.getByRole('dialog', { name: 'Town activity' })
  await expect(activity).toBeVisible()
  await activity.getByRole('button', { name: 'Mark all read' }).click()
  await expect(activity.getByRole('button', { name: 'Mark all read' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(toasts.locator('.notice')).toHaveCount(0)
})
