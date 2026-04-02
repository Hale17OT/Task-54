import { test, expect } from '@playwright/test';
import { fullStackAvailable, loginAs } from './helpers';

test.describe('Notifications', () => {
  test('notification center renders with status indicator', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await page.locator('nav').getByText('Notifications').click();
    // Must show either unread count or all-caught-up — always one or the other
    await expect(page.getByText(/\d+ unread|All caught up/)).toBeVisible({ timeout: 10000 });
  });

  test('mark all read transitions to all-caught-up state', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await page.goto('/notifications');
    await expect(page.getByText(/\d+ unread|All caught up/)).toBeVisible({ timeout: 10000 });
    // Click Mark All Read — must exist or page is already caught up
    const markAllBtn = page.getByRole('button', { name: 'Mark All Read' });
    const hasBtnVisible = await markAllBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasBtnVisible) {
      const countBefore = await page.getByText(/\d+ unread/).textContent();
      await markAllBtn.click();
      await expect(page.getByText('All caught up')).toBeVisible({ timeout: 5000 });
      // Verify the button is now gone (no more unread)
      await expect(markAllBtn).not.toBeVisible();
    } else {
      // Already caught up — verify state is consistent
      await expect(page.getByText('All caught up')).toBeVisible();
    }
  });

  test('notification list renders items or empty state', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await page.goto('/notifications');
    // Wait for page to finish loading — either notification items or empty state
    await expect(
      page.locator('[class*="border-primary"]').first().or(page.getByText('No notifications'))
    ).toBeVisible({ timeout: 15000 });
  });
});
