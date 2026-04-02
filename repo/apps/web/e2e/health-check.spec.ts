import { test, expect } from '@playwright/test';
import { fullStackAvailable, loginAs } from './helpers';

test.describe('Health Check - Report List', () => {
  test('staff sees list with table columns and new button', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.locator('nav').getByText('Health Reports').click();
    await expect(page.locator('main').getByText('Health check reports')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Report' })).toBeVisible();
    // Page must show either table with data or empty state
    await expect(
      page.getByText('Date').or(page.getByText('No health reports'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('reviewer sees awaiting-review label', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'reviewer1', 'Reviewer12345!');
    await page.locator('nav').getByText('Health Reports').click();
    await expect(page.locator('main').getByText('Reports awaiting your review')).toBeVisible();
  });
});

test.describe('Health Check - Create Report', () => {
  test('form has patient ID, template, result items, add item button', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/reports/new');
    await expect(page.getByLabel('Patient ID')).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel('Template')).toBeVisible();
    await expect(page.getByText('Result Items')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible();
  });

  test('invalid patient ID shows inline validation error and disables submit', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/reports/new');
    await page.getByLabel('Patient ID').fill('not-a-uuid');
    await expect(page.getByText('Must be a valid UUID format')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Report' })).toBeDisabled();
    // Fix to valid UUID
    await page.getByLabel('Patient ID').fill('00000000-0000-0000-0000-000000000004');
    await expect(page.getByText('Must be a valid UUID format')).not.toBeVisible();
  });

  test('template selection populates result items from seed templates', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/reports/new');
    await page.locator('#template').selectOption({ index: 1 });
    // Seed template "Basic Health Check" has BP, HR, Temp, BMI etc.
    await expect(page.locator('input[value="Blood Pressure Systolic"]')).toBeVisible({ timeout: 5000 });
  });

  test('create button disabled without patient ID + template + items', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/reports/new');
    await expect(page.getByRole('button', { name: 'Create Report' })).toBeDisabled();
  });
});

test.describe('Health Check - Access Control', () => {
  test('reviewer sees Access Denied on enrollment pages', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'reviewer1', 'Reviewer12345!');
    await page.goto('/enrollments');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('reviewer').first()).toBeVisible();
  });

  test('patient cannot create reports', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await page.goto('/reports/new');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
  });
});
