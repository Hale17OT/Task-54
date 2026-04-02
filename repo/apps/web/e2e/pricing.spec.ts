import { test, expect } from '@playwright/test';
import { fullStackAvailable, loginAs } from './helpers';

test.describe('Pricing Rules - Admin Management', () => {
  test('shows pricing rules table with seed data', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.locator('nav').getByText('Pricing Rules').click();
    await expect(page.getByText('Manage promotion and discount rules')).toBeVisible();
    await expect(page.getByText('10% Off Over')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('BOGO Screenings')).toBeVisible();
    // Table columns
    await expect(page.getByText('Name')).toBeVisible();
    await expect(page.getByText('Type')).toBeVisible();
    await expect(page.getByText('Min Order $')).toBeVisible();
    // Active column header exists (may also appear in status badges)
    await expect(page.getByRole('columnheader', { name: 'Active' }).or(page.getByText('Active').first())).toBeVisible();
  });

  test('create form has all fields for complete rule configuration', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.goto('/admin/pricing');
    await page.getByRole('button', { name: 'New Rule' }).click();
    await expect(page.getByText('Create Pricing Rule')).toBeVisible();
    // Core fields
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Type')).toBeVisible();
    await expect(page.getByLabel('Priority')).toBeVisible();
    await expect(page.getByLabel('Value')).toBeVisible();
    // Applicability fields
    await expect(page.getByLabel('Min Quantity')).toBeVisible();
    await expect(page.getByLabel('Min Order Subtotal')).toBeVisible();
    await expect(page.getByLabel('Exclusion Group')).toBeVisible();
    await expect(page.getByLabel('Applicable Categories')).toBeVisible();
    await expect(page.getByLabel('Applicable Service IDs')).toBeVisible();
    // Validity fields
    await expect(page.getByLabel('Valid From')).toBeVisible();
    await expect(page.getByLabel('Valid Until')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
  });

  test('create form validates — disabled without required fields', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.goto('/admin/pricing');
    await page.getByRole('button', { name: 'New Rule' }).click();
    await expect(page.getByRole('button', { name: 'Create Rule' })).toBeDisabled();
    // Fill required fields
    await page.getByLabel('Name').fill('Test Rule');
    await page.getByLabel('Value').fill('10');
    await page.getByLabel('Valid From').fill('2026-01-01T00:00');
    await page.getByLabel('Valid Until').fill('2026-12-31T23:59');
    await expect(page.getByRole('button', { name: 'Create Rule' })).toBeEnabled();
  });

  test('cancel button hides create form', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.goto('/admin/pricing');
    await page.getByRole('button', { name: 'New Rule' }).click();
    await expect(page.getByText('Create Pricing Rule')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Create Pricing Rule')).not.toBeVisible();
  });
});

test.describe('Pricing Rules - Access Control', () => {
  test('patient sees Access Denied with role info', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await page.goto('/admin/pricing');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('patient').first()).toBeVisible();
    await expect(page.getByText('Manage promotion')).not.toBeVisible();
  });

  test('staff sees Access Denied on pricing admin', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/admin/pricing');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
  });
});
