import { test, expect } from '@playwright/test';
import { fullStackAvailable, loginAs } from './helpers';

test.describe('Authentication - Standalone', () => {
  test('login page renders with all form elements and branding', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Welcome to CHECC')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Community Health Enrollment & Clinic Commerce')).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  test('all protected routes redirect to /login when unauthenticated', async ({ page }) => {
    for (const route of ['/', '/enrollments', '/orders/history', '/reports', '/payments/record', '/admin/pricing', '/admin/risk', '/notifications', '/content']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });
});

test.describe('Authentication - Full Stack', () => {
  test('invalid login shows error', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await page.goto('/login');
    await page.getByLabel('Username').fill('bad');
    await page.getByLabel('Password').fill('bad');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('admin login: dashboard loads + full nav visible', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await expect(page.locator('nav').getByText('Pricing Rules')).toBeVisible();
    await expect(page.locator('nav').getByText('Risk Dashboard')).toBeVisible();
    await expect(page.locator('nav').getByText('Health Reports')).toBeVisible();
  });

  test('patient login: limited nav, no admin/payments', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await expect(page.locator('nav').getByText('Enrollments')).toBeVisible();
    await expect(page.locator('nav').getByText('Pricing Rules')).not.toBeVisible();
    await expect(page.locator('nav').getByText('Payments')).not.toBeVisible();
  });

  test('reviewer login: reports + notifications only', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'reviewer1', 'Reviewer12345!');
    await expect(page.locator('nav').getByText('Health Reports')).toBeVisible();
    await expect(page.locator('nav').getByText('Enrollments')).not.toBeVisible();
  });

  test('logout clears session and prevents re-access', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.getByLabel('Logout').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    // App shell inaccessible after logout (in-memory tokens cleared)
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
