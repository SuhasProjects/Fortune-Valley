import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test('bank tools keep one-time transfers separate from recurring policies', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Entry-Level Worker/ }).click();
  await page.getByRole('button', { name: /Open Pine Bank:/ }).click();
  await page.getByText('Move money once', { exact: true }).click();
  const withdrawal = page.getByLabel('Withdraw savings to cash', { exact: true });
  await withdrawal.fill('100');
  await page.getByRole('button', { name: 'Transfer to cash', exact: true }).click();
  await expect(withdrawal).toHaveValue('');
  await expect(page.getByRole('status')).toHaveText('One-time transfer applied.');
  await expect(page.getByRole('button', { name: 'Transfer to cash', exact: true })).toBeDisabled();

  await page.getByText('Recurring debt payment & cash buffer', { exact: true }).click();
  await page.getByLabel('Extra debt payment / month', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Save recurring debt payment', exact: true }).click();
  await page.getByLabel('Cash buffer for contributions', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'Save cash buffer', exact: true }).click();
  await expect(page.locator('form').filter({ has: page.getByLabel('Cash buffer for contributions', { exact: true }) }).getByRole('status')).toHaveText('Policy saved.');
  await page.getByLabel('Cash buffer for contributions', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL(`screenshots/${info.project.name}-bank-tools.png`, import.meta.url)) });
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: /Next month/ }).click();
  await page.getByRole('button', { name: /Open Pine Bank:/ }).click();
  await page.getByText('Recurring debt payment & cash buffer', { exact: true }).click();
  await expect(page.getByLabel('Extra debt payment / month', { exact: true })).toHaveValue('25');
  await expect(page.getByLabel('Cash buffer for contributions', { exact: true })).toHaveValue('500');

  await page.getByText('Move money once', { exact: true }).click();
  await withdrawal.fill('100000000');
  await expect(page.getByRole('button', { name: 'Transfer to cash', exact: true })).toBeDisabled();
  await expect(withdrawal).toHaveAttribute('aria-invalid', 'true');
  expect(errors).toEqual([]);
});
