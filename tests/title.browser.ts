import { test, expect } from '@playwright/test'

// OWNER: Agent 5 (title screen). Tests for the entry screen only; replace these as the title screen is rebuilt.

test('landing renders in the pixel fonts without horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Small choices. A clearer financial future.' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole('heading', { name: 'Small choices. A clearer financial future.' })).toHaveCSS('font-family', /sans-serif/)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => innerWidth))
  await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-landing.png`, fullPage: true })
})

test('landing navigation expands instructions and keeps account placeholders inactive', async ({ page }) => {
  await page.goto('/')
  const how = page.getByRole('button', { name: 'How it works', exact: true })
  await expect(how).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('heading', { name: 'Choose a starting point' })).not.toBeVisible()
  await how.click()
  await expect(how).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('heading', { name: 'Choose a starting point' })).toBeVisible()
  await how.click()
  await expect(how).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('heading', { name: 'Choose a starting point' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeDisabled()
  await page.getByRole('link', { name: 'Starting lives', exact: true }).click()
  await expect(page).toHaveURL(/#starting-lives$/)
  await expect(page.getByRole('button', { name: /College Student/ })).toBeVisible()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => innerWidth))
})

test('sticky landing menu reaches the game guide and accessible FAQs', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Learn by living a little.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Play a month. See what changes.' })).toBeVisible()
  await page.getByRole('link', { name: 'The town', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Five buildings. Connected choices.' })).toBeVisible()
  await expect(page.locator('.welcome-header')).toHaveCSS('position', 'sticky')
  await expect.poll(() => page.locator('.welcome-header').evaluate(el => el.getBoundingClientRect().top)).toBe(0)
  await page.getByRole('link', { name: 'FAQs', exact: true }).click()
  await page.getByText('Is any real money involved?', { exact: true }).click()
  await expect(page.getByText('No. Every balance, paycheck, investment, and payment belongs to a fictional simulation. No bank connection is needed.')).toBeVisible()
  await expect.poll(() => page.locator('.welcome-header').evaluate(el => el.getBoundingClientRect().top)).toBe(0)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => innerWidth))
  expect(await page.locator('.welcome-page').innerText()).not.toMatch(/[↗↓↑↳⌄]/)
  await page.getByRole('button', { name: 'How it works', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose a starting point' })).toBeVisible()
})
