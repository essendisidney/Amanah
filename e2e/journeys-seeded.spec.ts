import { expect, test, type Page } from '@playwright/test';

/**
 * Seeded local journeys — requires `npx supabase start` + seed users:
 * admin@jamiya.local / alice@jamiya.local / bob@jamiya.local / Password1!
 * Run only against local Next pointed at local Supabase (never production).
 */

const PASSWORD = 'Password1!';

async function signInEmail(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: /email/i }).click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).not.toHaveURL(/login/, { timeout: 30_000 });
}

test.describe('Journey 8 — Platform admin Support (seeded)', () => {
  test('admin opens Support via direct load', async ({ page }) => {
    await signInEmail(page, 'admin@jamiya.local');
    await page.goto('/admin/support');
    await expect(page).toHaveURL(/\/admin\/support/);
    await expect(page.getByRole('heading', { name: /support tickets/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test('admin opens Support via nav (no client exception)', async ({ page }) => {
    await signInEmail(page, 'admin@jamiya.local');
    await page.goto('/admin');
    await page.getByRole('link', { name: 'Support' }).first().click();
    await expect(page).toHaveURL(/\/admin\/support/);
    await expect(page.getByRole('heading', { name: /support tickets/i })).toBeVisible({
      timeout: 20_000,
    });
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.reload();
    await expect(page.getByRole('heading', { name: /support tickets/i })).toBeVisible();
    expect(errors.filter((e) => /Minified React error #310|insertBefore|removeChild/i.test(e))).toEqual(
      [],
    );
  });

  test('ordinary member cannot open admin Support', async ({ page }) => {
    await signInEmail(page, 'bob@jamiya.local');
    await page.goto('/admin/support');
    await expect(page).toHaveURL(/dashboard|login/);
    await expect(page.getByRole('heading', { name: /support tickets/i })).toHaveCount(0);
  });
});

test.describe.configure({ mode: 'serial' });

test.describe('Journey 7 — Support ticket (seeded)', () => {
  test('member can submit a labelled test ticket', async ({ page }) => {
    await signInEmail(page, 'alice@jamiya.local');
    await page.goto('/help#ticket');
    await page.getByLabel(/subject/i).fill('E2E audit ticket — do not escalate');
    await page.getByLabel(/message/i).fill(
      'Isolated local seed ticket for journey audit. Safe to close.',
    );
    await page.getByRole('button', { name: /send|submit/i }).click();
    await expect(page.getByText(/request sent|sent/i)).toBeVisible({ timeout: 20_000 });
  });

  test('admin replies in-app and member sees status', async ({ page }) => {
    await signInEmail(page, 'admin@jamiya.local');
    await page.goto('/admin/support');
    await expect(page.getByText(/E2E audit ticket/i)).toBeVisible({ timeout: 20_000 });
    const replyBox = page.getByLabel('Reply').first();
    await replyBox.fill('Local seed reply — safe to ignore.');
    await page.getByRole('button', { name: /send reply/i }).first().click();
    await expect(page.getByText(/Local seed reply/i).first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/login');
    await signInEmail(page, 'alice@jamiya.local');
    await page.goto('/help');
    await expect(page.getByText(/E2E audit ticket/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Local seed reply/i)).toBeVisible();
  });

  test('bob cannot see alice ticket', async ({ page }) => {
    await signInEmail(page, 'bob@jamiya.local');
    await page.goto('/help');
    await expect(page.getByText(/E2E audit ticket/i)).toHaveCount(0);
  });
});

test.describe('Journey 1 — New / existing member smoke (seeded)', () => {
  test('alice sees seeded circle on dashboard', async ({ page }) => {
    await signInEmail(page, 'alice@jamiya.local');
    await page.goto('/dashboard');
    await expect(page.getByText(/Nairobi Sisters|circle/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('invalid invite token surfaces an error', async ({ page }) => {
    await page.goto('/invitations/not-a-real-invite-code');
    await expect(page.locator('body')).toContainText(/invalid|expired|not found|invite/i);
  });
});
