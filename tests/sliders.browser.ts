import { expect, test } from '@playwright/test'
import { openTitle, startStory } from './helpers'

// OWNER: sliders brief. Log-scale money sliders in Home, Bank and Market.

test('dragging the Home budget slider changes the preview and never exceeds its cap', async ({ page }, testInfo) => {
  await openTitle(page)
  await startStory(page, 'Entry-Level Worker')
  await page.getByRole('button', { name: /Open Your Home/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Your Home' })
  await expect(dialog).toBeVisible()
  const slider = dialog.getByRole('slider')
  const max = Number(await slider.getAttribute('aria-valuemax'))
  const preview = dialog.getByRole('region', { name: 'Projected consequence' })
  const before = (await preview.textContent())!
  await slider.scrollIntoViewIfNeeded()
  const box = (await slider.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  const dragged = Number(await slider.getAttribute('aria-valuenow'))
  expect(dragged).toBeLessThanOrEqual(max)
  expect(dragged).toBeGreaterThan(0)
  await expect(preview).not.toHaveText(before)
  await expect(preview).toContainText('After 12 months')
  await expect(dialog.locator('output')).toContainText('/ month')
  if (testInfo.project.name === 'desktop') await page.screenshot({ path: 'docs/screenshots/desktop-home-slider.png' })
  else await page.screenshot({ path: 'docs/screenshots/mobile-home-slider.png' })
  await slider.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuenow', '5')
  await expect(dialog.locator('output')).toContainText('$5.00 / month')
  await page.getByRole('button', { name: 'Close panel' }).click()

  await page.getByRole('button', { name: /Open Pine Bank/ }).click()
  const bank = page.getByRole('dialog', { name: 'Pine Bank' })
  const input = bank.getByLabel('Monthly savings contribution (USD)', { exact: true })
  const savings = bank.getByRole('slider', { name: 'Monthly savings contribution slider' })
  const savingsMax = Number(await savings.getAttribute('aria-valuemax'))
  await savings.scrollIntoViewIfNeeded()
  const sbox = (await savings.boundingBox())!
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2)
  await page.mouse.down(); await page.mouse.move(sbox.x + sbox.width - 1, sbox.y + sbox.height / 2, { steps: 8 }); await page.mouse.up()
  await expect(input).toHaveValue(String(savingsMax))
  await input.fill('325')
  await expect(savings).toHaveAttribute('aria-valuenow', '325')
  if (testInfo.project.name === 'desktop') await page.screenshot({ path: 'docs/screenshots/desktop-bank-slider.png' })
})
