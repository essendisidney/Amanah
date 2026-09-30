import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Password1!';

/**
 * Email sign-in that tolerates a not-yet-hydrated login page:
 * a tap before React attaches does nothing, so retry until the form shows.
 */
export async function signInEmail(page: Page, email: string) {
  // Signed-in users are redirected away from /login, so always start from a clean session.
  await page.context().clearCookies();
  await page.goto('/login').catch(() => {});
  await page.waitForLoadState('load').catch(() => {});
  const emailField = page.getByLabel(/email/i);
  for (let i = 0; i < 8; i++) {
    if (await emailField.isVisible().catch(() => false)) break;
    await page.getByRole('button', { name: /email/i }).first().click().catch(() => {});
    await page.waitForTimeout(1_000);
  }
  await emailField.fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).last().click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
}
