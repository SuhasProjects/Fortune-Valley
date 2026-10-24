import { expect, type Page } from '@playwright/test'

// OWNER: Agent 5 (title screen). Every other browser test starts a game through these helpers,
// so when the title screen changes only this file has to follow it.

/** Load the app on the title screen with fonts ready. */
export async function openTitle(page: Page) {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expectOnTitle(page)
}

/** Assert the title screen is showing (used after "play again" / quit to title). */
export async function expectOnTitle(page: Page) {
  await expect(page.getByRole('heading', { name: 'Small choices. A clearer financial future.' })).toBeVisible()
}

/** From the title screen, start one of the premade lives by its archetype title. */
export async function startStory(page: Page, life: 'College Student' | 'Entry-Level Worker' | 'Professional' | 'Young Family') {
  await page.getByRole('button', { name: new RegExp(life) }).click()
  await expect(page.getByRole('button', { name: /Open Pine Bank:/ })).toBeVisible()
}

/** Assert the results (reveal) screen is showing after "Finish & reveal". */
export async function expectReveal(page: Page) {
  await expect(page.getByRole('dialog', { name: 'Your next chapter' })).toContainText('Same strategy, 1,000 futures')
}

/** Leave the reveal and return to the title screen. */
export async function leaveReveal(page: Page) {
  await page.getByRole('button', { name: /Choose a new story/ }).click()
  await expectOnTitle(page)
}
