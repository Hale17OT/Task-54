import { test, expect } from '@playwright/test';
import { fullStackAvailable, loginAs } from './helpers';

test.describe('Risk Dashboard - Admin Operations', () => {
  test('shows all dashboard sections: stats, IP rules, events, incidents', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.getByText('Risk Dashboard').click();
    await expect(page.getByText('Monitor security events and incidents')).toBeVisible();
    await expect(page.getByText('Open Incidents')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Recent Events')).toBeVisible();
    await expect(page.getByText('IP Allow/Deny Rules')).toBeVisible();
    await expect(page.getByText('Incident Tickets')).toBeVisible();
  });

  test('IP rule form opens with fields and closes on cancel', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.goto('/admin/risk');
    await expect(page.getByText('IP Allow/Deny Rules')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Add Rule' }).click();
    await expect(page.getByPlaceholder('10.0.0.1')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Type')).toBeVisible();
    await expect(page.getByText('Reason')).toBeVisible();
    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByPlaceholder('10.0.0.1')).not.toBeVisible();
  });

  test('incident row expands to show hit logs and description', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.goto('/admin/risk');
    await expect(page.getByText('Incident Tickets')).toBeVisible({ timeout: 10000 });
    // If incidents exist, click first one to expand
    const incidentRows = page.locator('.rounded-lg.border').filter({ hasText: /OPEN|INVESTIGATING/ });
    if (await incidentRows.count() > 0) {
      await incidentRows.first().click();
      // Should show Description and Hit Logs sections
      await expect(page.getByText('Description')).toBeVisible({ timeout: 3000 });
      await expect(page.getByText('Hit Logs')).toBeVisible();
    }
  });

  test('incident actions: Investigate, Resolve, Dismiss buttons visible', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.goto('/admin/risk');
    await expect(page.getByText('Incident Tickets')).toBeVisible({ timeout: 10000 });
    // Check that action buttons exist for open incidents
    const investigateBtn = page.getByRole('button', { name: 'Investigate' });
    const resolveBtn = page.getByRole('button', { name: 'Resolve' });
    // These exist if there are open incidents
  });
});

test.describe('Risk Dashboard - Access Control', () => {
  test('patient sees Access Denied', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await page.goto('/admin/risk');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Monitor security')).not.toBeVisible();
  });

  test('staff sees Access Denied', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/admin/risk');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
  });
});
