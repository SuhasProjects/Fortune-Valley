import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { openTitle, startStory } from '../../../tests/helpers';

test('canonical stress route renders every panel and applies only saved engine actions', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/dev/stress-states');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Financial panels · stress states' })).toBeVisible();
  for (const name of ['Bank', 'Market', 'Insurance', 'Home', 'Office']) await expect(page.getByRole('region', { name, exact: true })).toHaveCount(8);
  await expect(page.locator('body')).not.toContainText('NaN');
  await expect(page.locator('body')).not.toContainText('undefined');
  const noCashBank = page.getByRole('region', { name: 'No cash', exact: true }).getByRole('region', { name: 'Bank', exact: true });
  await noCashBank.getByText('Extra debt payment', { exact: true }).click();
  await expect(noCashBank.getByLabel('One-time debt payment (USD)', { exact: true })).toBeDisabled();

  const worker = page.getByRole('region', { name: 'Entry-Level Worker', exact: true });
  const bank = worker.getByRole('region', { name: 'Bank', exact: true });
  const savings = bank.getByLabel('Monthly savings contribution (USD)', { exact: true });
  await savings.fill('-1');
  await expect(bank.getByRole('button', { name: 'Save savings contribution', exact: true })).toBeDisabled();
  await savings.fill('300');
  await expect(bank.getByLabel('12-month policy preview')).toContainText('After 12 months');
  await bank.getByRole('button', { name: 'Save savings contribution', exact: true }).click();
  await expect(bank.getByText('Saved.', { exact: true })).toBeVisible();
  await bank.getByRole('button', { name: 'Help for Bank' }).click();
  await expect(bank.getByLabel('12-month preview details')).toContainText('Change a value');
  await bank.getByRole('button', { name: 'Close help' }).click();
  await bank.screenshot({ path: fileURLToPath(new URL(`screenshots/${info.project.name}-stress-bank.png`, import.meta.url)) });

  const insurance = worker.getByRole('region', { name: 'Insurance', exact: true });
  await expect(insurance.getByRole('radio')).toHaveCount(2);
  await insurance.getByLabel(/High premium \/ low deductible/).check();
  await insurance.getByRole('button', { name: 'Save health plan', exact: true }).click();
  await expect(insurance.getByText('Saved.', { exact: true })).toBeVisible();
  const home = worker.getByRole('region', { name: 'Home', exact: true });
  await expect(home.getByRole('slider')).toHaveCount(1);
  await home.getByRole('slider').press('ArrowRight');
  await home.getByRole('button', { name: 'Save budget', exact: true }).click();
  await expect(home.getByText('Saved.', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('financial sheet is centered, compact, and keeps help separate from the modal', async ({ page }, info) => {
  await openTitle(page);
  await startStory(page, 'Entry-Level Worker');
  await page.getByRole('button', { name: /Open Pine Bank:/ }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Pine Bank', exact: true });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox(); const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(2);
  expect(box!.width).toBeLessThanOrEqual(viewport.width - 20);
  if (info.project.name === 'desktop') expect(box!.width).toBeGreaterThan(700);
  const headingBox = await dialog.getByRole('heading', { name: 'Pine Bank', exact: true }).boundingBox();
  const bodyBox = await dialog.locator('.fv-window__body').boundingBox();
  expect(headingBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(headingBox!.y).toBeLessThan(bodyBox!.y);
  await expect(dialog.getByText('Extra payments use cash and reduce the debt.', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Monthly savings contribution (USD)').fill('300');
  await expect(dialog.getByLabel('12-month policy preview')).toContainText('After 12 months');
  await page.screenshot({ path: fileURLToPath(new URL(`screenshots/${info.project.name}-centered-bank.png`, import.meta.url)) });
  await dialog.getByRole('button', { name: 'Help for Bank' }).click();
  await expect(dialog.getByRole('dialog', { name: 'Bank help' })).toBeVisible();
  await page.screenshot({ path: fileURLToPath(new URL(`screenshots/${info.project.name}-bank-help.png`, import.meta.url)) });
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('dialog', { name: 'Bank help' })).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Help for Bank' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

const buildingWindows = [
  ['bank', 'Pine Bank'],
  ['office', 'Town Office'],
  ['hospital', 'Health House'],
  ['home', 'Your Home'],
  ['market', 'Market Hall'],
] as const;

for (const viewport of [{ width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }]) {
  test(`all building windows fit and keep keyboard focus at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Laptop layout checks; mobile Bank is covered separately.');
    await page.setViewportSize(viewport);
    await openTitle(page);
    await startStory(page, 'Entry-Level Worker');
    for (const [id, name] of buildingWindows) {
      const opener = page.getByRole('button', { name: new RegExp(`Open ${name}:`) });
      await opener.focus(); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name, exact: true });
      await expect(dialog).toBeVisible();
      const heading = dialog.getByRole('heading', { name, exact: true });
      await expect(heading).toBeVisible();
      const box = await dialog.boundingBox();
      const headingBox = await heading.boundingBox();
      const bodyBox = await dialog.locator('.fv-window__body').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      expect(headingBox!.y).toBeLessThan(bodyBox!.y);
      await expect(dialog.getByRole('heading', { name: 'Now', exact: true })).toBeVisible();
      await expect(dialog.getByRole('heading', { name: 'Your decision', exact: true })).toBeVisible();
      await expect(dialog.getByRole('heading', { name: 'What happens next', exact: true })).toBeVisible();
      await expect(dialog).not.toContainText(/NaN|undefined/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
      await dialog.screenshot({ path: fileURLToPath(new URL(`screenshots/window-${viewport.width}-${name.toLowerCase().replaceAll(' ', '-')}.png`, import.meta.url)) });
      if (viewport.width === 1440) {
        await dialog.screenshot({ path: fileURLToPath(new URL(`screenshots/window-${id}.png`, import.meta.url)) });
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    }
  });
}
