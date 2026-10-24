import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

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
  await noCashBank.getByText('Make a one-time extra debt payment', { exact: true }).click();
  await expect(noCashBank.getByLabel('One-time debt payment (USD)', { exact: true })).toBeDisabled();

  const worker = page.getByRole('region', { name: 'Entry-Level Worker', exact: true });
  const bank = worker.getByRole('region', { name: 'Bank', exact: true });
  const savings = bank.getByLabel('Monthly savings contribution (USD)', { exact: true });
  await savings.fill('-1');
  await expect(bank.getByRole('button', { name: 'Save savings contribution', exact: true })).toBeDisabled();
  await savings.fill('300');
  await bank.getByRole('button', { name: 'Save savings contribution', exact: true }).click();
  await expect(bank.getByText('Saved.', { exact: true })).toBeVisible();
  await expect(bank.getByLabel('12-month policy preview')).toContainText('Preview unavailable');
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
