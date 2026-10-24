import { test, expect } from '@playwright/test'
import { expectReveal, leaveReveal, openTitle, startStory } from './helpers'

// OWNER: Agent 4 (game flow). End-to-end smoke of a played game. Start games only through ./helpers.

test('larger text fits a narrow phone without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await openTitle(page)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320)
  await startStory(page, 'College Student')
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320)
  await page.getByRole('button', { name: /Open Pine Bank/ }).click()
  await expect(page.getByRole('dialog', { name: 'Pine Bank' })).toBeVisible()
})

test('town navigation, focus, month tick, history and finish', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/api/ai', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"disabled"}' }))
  await openTitle(page)
  await startStory(page, 'Entry-Level Worker')
  const buildingNames = ['Pine Bank', 'Town Office', 'Health House', 'Your Home', 'Market Hall']
  for (const [index, name] of buildingNames.entries()) {
    const button = page.getByRole('button', { name: new RegExp(`Open ${name}:`) })
    await button.scrollIntoViewIfNeeded()
    await button.focus()
    if (testInfo.project.name === 'mobile') await page.keyboard.press(String(index + 1))
    else await button.click()
    await expect(page.getByRole('dialog', { name })).toBeVisible()
    await page.keyboard.press('Escape')
    await button.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name })
    await expect(dialog).toBeVisible()
    // Native dialogs trap Tab inside the panel.
    await page.keyboard.press('Tab')
    await expect(dialog).toContainText('Your decision')
    if (name === 'Market Hall') {
      await expect(dialog.getByRole('group', { name: 'Stocks allocation' })).toContainText('Last month')
      await expect(dialog.getByRole('group', { name: 'Stocks allocation' })).toContainText('Annual assumption')
      await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-market.png` })
    }
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(button).toBeFocused()
  }
  await page.getByRole('button', { name: /Next month/ }).click()
  await expect(page.getByText(/^Month 1 \/ \d+$/)).toBeVisible()
  await page.getByRole('button', { name: /Pause/ }).click()
  await expect(page.getByRole('button', { name: /Next month/ })).toBeDisabled()
  await page.getByRole('button', { name: /Resume/ }).click()
  await page.getByRole('button', { name: /Next month/ }).click()
  await page.getByRole('button', { name: /Next month/ }).click()
  await expect(page.getByRole('button', { name: /Decision waiting/ }).first()).toBeVisible()
  await page.getByRole('button', { name: 'View all activity' }).click()
  await expect(page.getByRole('dialog', { name: 'Town activity' })).toBeVisible()
  await page.getByRole('button', { name: 'Close panel' }).click()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => innerWidth))
  await expect(page.locator('.activity-area .notice')).toHaveCount(3)
  await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-town.png`, fullPage: true })
  await page.getByRole('button', { name: /Open Pine Bank/ }).click()
  await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-panel.png`, fullPage: true })
  // The narrow mobile dialog leaves only 8px of backdrop outside its bounds.
  await page.mouse.click(2, 2)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: /Finish & reveal/ }).click()
  await expectReveal(page)
  await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-results.png`, fullPage: true })
  await leaveReveal(page)
  expect(errors).toEqual([])
})

test('financial policies save through the town and persist after a month', async ({ page }) => {
  await openTitle(page)
  await startStory(page, 'Entry-Level Worker')
  await page.getByRole('button', { name: /Open Pine Bank:/ }).click()
  await page.getByLabel('Monthly savings contribution (USD)', { exact: true }).fill('300')
  await expect(page.getByLabel('12-month policy preview')).toContainText('After 12 months')
  await page.getByRole('button', { name: 'Save savings contribution', exact: true }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  await page.getByRole('button', { name: 'Close panel' }).click()
  await page.getByRole('button', { name: /Next month/ }).click()
  await page.getByRole('button', { name: /Open Pine Bank:/ }).click()
  await expect(page.getByLabel('Monthly savings contribution (USD)', { exact: true })).toHaveValue('300')
})
