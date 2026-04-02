import { test, expect } from '@playwright/test';
import { fullStackAvailable, loginAs } from './helpers';

test.describe('User Isolation & Session Security', () => {
  test('logout redirects to login and app shell is inaccessible', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await expect(page.locator('nav').getByText('Dashboard', { exact: true })).toBeVisible();

    await page.getByLabel('Logout').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // App shell inaccessible — in-memory tokens cleared
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('switching users shows correct role-specific nav', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await expect(page.getByText('Pricing Rules')).toBeVisible();

    await page.getByLabel('Logout').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    await loginAs(page, 'patient1', 'Patient12345!');
    await expect(page.getByText('Pricing Rules')).not.toBeVisible();
    await expect(page.locator('nav').getByText('Enrollments')).toBeVisible();
  });

  test('protected route redirects to login after logout', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.getByLabel('Logout').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    await page.goto('/payments/record');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('unauthenticated direct URL access redirects to login', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await page.goto('/enrollments');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('API call returns 401 after logout', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.getByLabel('Logout').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    const status = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/me');
        return res.status;
      } catch { return 0; }
    });
    expect(status).toBe(401);
  });
});
