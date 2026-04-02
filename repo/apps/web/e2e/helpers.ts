import { test, expect, type Page } from '@playwright/test';

/**
 * Whether the full backend stack is available.
 * Set FULL_STACK=true when running with docker compose up.
 * When false, full-stack tests are skipped cleanly.
 */
export const fullStackAvailable = process.env.FULL_STACK === 'true';

/**
 * Helper: login as a given user.
 * Should only be called in full-stack test contexts.
 */
export async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/login');
  await expect(page.getByLabel('Username')).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  // Wait for dashboard main content — use heading for specificity in Docker
  await expect(page.locator('main').getByText('Dashboard')).toBeVisible({ timeout: 30000 });
}

/**
 * Client-side navigation that preserves in-memory auth tokens.
 * Uses History API + popstate to trigger React Router without full reload.
 * Must be called AFTER loginAs (needs an active SPA session).
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // Small delay for React Router to process the navigation
  await page.waitForTimeout(500);
}
