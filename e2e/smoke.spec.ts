import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
  test('landing page loads brand and primary CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The boot splash also says "Jameiyah" but is hidden once loaded; check a visible match.
    await expect(page.getByText(/jameiyah/i).filter({ visible: true }).first()).toBeVisible();
  });

  test('login page renders email form', async ({ page }) => {
    // Sign-in opens on a method picker; ?method=email links straight to the form (works before hydration).
    await page.goto('/login?method=email');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });

  test('protected dashboard redirects unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('admin support redirects unauthenticated users (unauthorized stays blocked)', async ({
    page,
  }) => {
    await page.goto('/admin/support');
    await expect(page).toHaveURL(/login/);
  });
});
