import { test, expect } from '@playwright/test';
import { fullStackAvailable, loginAs } from './helpers';

test.describe('Content - Admin Workflow', () => {
  test('admin sees content management with New Article button', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.locator('nav').getByText('Content').click();
    await expect(page.locator('main').getByText('Content Management')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Article' })).toBeVisible();
  });

  test('article creation form has all fields including media', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.goto('/content/new');
    await expect(page.getByLabel('Title')).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel('Content Type')).toBeVisible();
    await expect(page.getByLabel('Body')).toBeVisible();
    await expect(page.getByText('Media Assets')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Media' })).toBeVisible();
  });

  test('create form validates — disabled without title and body', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.goto('/content/new');
    await expect(page.getByRole('button', { name: 'Create Article' })).toBeDisabled();
    await page.getByLabel('Title').fill('Test');
    await expect(page.getByRole('button', { name: 'Create Article' })).toBeDisabled();
    await page.getByLabel('Body').fill('Body content');
    await expect(page.getByRole('button', { name: 'Create Article' })).toBeEnabled();
  });

  test('content type dropdown has all options', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'admin', 'Admin12345678!');
    await page.goto('/content/new');
    const select = page.locator('#contentType');
    await expect(select.locator('option')).toHaveCount(4); // article, gallery, audio, video
  });
});

test.describe('Content - Patient View', () => {
  test('patient sees Wellness Content without create button', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'patient1', 'Patient12345!');
    await page.locator('nav').getByText('Content').click();
    await expect(page.locator('main').getByRole('heading', { name: 'Wellness Content' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Article' })).not.toBeVisible();
  });
});

test.describe('Content - Access Control', () => {
  test('staff sees Access Denied on content creation (admin-only)', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'staff1', 'Staff12345678!');
    await page.goto('/content/new');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
  });

  test('reviewer sees Access Denied on content page', async ({ page }) => {
    test.skip(!fullStackAvailable, 'Requires backend');
    await loginAs(page, 'reviewer1', 'Reviewer12345!');
    await page.goto('/content');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
  });
});
