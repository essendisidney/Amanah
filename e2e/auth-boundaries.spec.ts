import { expect, test } from '@playwright/test';

/**
 * Auth-boundary smoke against Preview/local — no writes, no seeded login required.
 * Full role journeys need local Supabase seed (see journeys-seeded.spec.ts).
 */
test.describe('admin support auth boundaries', () => {
  test('unauthenticated direct load of /admin/support redirects to login', async ({ page }) => {
    await page.goto('/admin/support');
    await expect(page).toHaveURL(/login/);
  });

  test('unauthenticated /admin also redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('public surfaces (read-only)', () => {
  test('sadaka browse loads', async ({ page }) => {
    await page.goto('/sadaka');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  });

  test('welcome loads for new-member entry', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.locator('body')).toBeVisible();
  });
});
