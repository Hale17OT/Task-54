import { test, expect } from '@playwright/test';
import { fullStackAvailable, loginAs } from './helpers';

test.describe('Payment - Record Form', () => {
  test('staff sees payment form with all fields and validation', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/payments/record');
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible();
    await expect(page.getByLabel('Order ID')).toBeVisible();
    await expect(page.getByLabel('Payment Method')).toBeVisible();
    await expect(page.getByLabel('Amount')).toBeVisible();
    await expect(page.getByLabel('Reference Number')).toBeVisible();
    // Submit disabled without order ID
    await expect(page.getByRole('button', { name: 'Record Payment' })).toBeDisabled();
  });

  test('payment method dropdown has all options', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/payments/record');
    const select = page.locator('#method');
    await expect(select.locator('option')).toHaveCount(3); // Cash, Check, Manual Card
  });
});

test.describe('Payment - History', () => {
  test('staff sees payment history with columns', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.locator('nav').getByText('Payments').click();
    await expect(page.getByRole('heading', { name: 'Payment History' })).toBeVisible();
    // Page must show either table with data or empty state
    await expect(
      page.getByText('Date').or(page.getByText('No payments'))
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Payment - Refund Form', () => {
  test('refund form shows reason codes and amount validation', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/payments/refund?paymentId=test&amount=100');
    await expect(page.getByRole('heading', { name: 'Process Refund' })).toBeVisible();
    await expect(page.getByLabel('Payment ID')).toBeVisible();
    await expect(page.getByLabel('Refund Amount')).toBeVisible();
    await expect(page.getByLabel('Reason Code')).toBeVisible();
    // Supervisor section shown for non-approver staff
    await expect(page.getByText('Supervisor approval required')).toBeVisible();
    await expect(page.getByLabel('Supervisor Username')).toBeVisible();
    await expect(page.getByLabel('Supervisor Password')).toBeVisible();
  });

  test('refund amount exceeding max shows error', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/payments/refund?paymentId=test-id&amount=100');
    await page.getByLabel('Refund Amount').fill('200');
    await page.getByLabel('Supervisor Username').fill('supervisor');
    await page.getByLabel('Supervisor Password').fill('pass');
    await page.getByRole('button', { name: 'Process Refund' }).click();
    await expect(page.getByText(/cannot exceed/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Payment - Access Control', () => {
  test('patient sees Access Denied on payment record page', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await page.goto('/payments/record');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Return to Dashboard' })).toBeVisible();
  });

  test('patient sees Access Denied on refund page', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await page.goto('/payments/refund');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
  });

  test('patient sidebar has no payment links', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await expect(page.locator('nav').getByText('Payments')).not.toBeVisible();
  });
});
