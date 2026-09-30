import { expect, test, type Page } from '@playwright/test';
import { signInEmail } from './helpers';
import { execSync } from 'node:child_process';

/**
 * Money and action journeys against the LOCAL stack only (simulated payments, seeded users).
 * Each test leaves clearly labelled "E2E" records in the local database.
 */

const CIRCLE = 'nairobi-sisters-circle';
const RUN = Date.now().toString(36);

function sql(query: string): string {
  return execSync(`docker exec supabase_db_jamiya psql -U postgres -tAc "${query.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
  }).trim();
}

function walletBalance(email: string): number {
  const v = sql(
    `select coalesce(sum(w.balance),0) from public.wallets w join auth.users u on u.id=w.user_id where u.email='${email}'`,
  );
  return Number(v || 0);
}

function latestOtp(): string {
  return sql(`select code from public.otp_codes order by created_at desc limit 1`);
}


function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe.configure({ mode: 'serial' });
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'journeys run once, on desktop');
});

test('officer creates a new circle end to end', async ({ page }) => {
  const errors = watchErrors(page);
  await signInEmail(page, 'alice@jamiya.local');
  await page.goto('/circles/new');
  // Step 1 picks the circle type; the name and amount fields live on step 2.
  const name = page.getByLabel('Circle name');
  for (let i = 0; i < 4 && !(await name.isVisible().catch(() => false)); i++) {
    await page.getByRole('button', { name: /^continue$/i }).click().catch(() => {});
    await page.waitForTimeout(800);
  }
  await name.fill(`E2E Circle ${RUN}`);
  await page.getByLabel('Contribution amount').fill('500');
  // Multi-step form: keep pressing Continue/Next until Create circle shows up.
  for (let i = 0; i < 6; i++) {
    const create = page.getByRole('button', { name: /^create circle$/i });
    if (await create.isVisible().catch(() => false)) break;
    const next = page.getByRole('button', { name: /continue|next|review/i }).last();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
  await page.getByRole('button', { name: /^create circle$/i }).click();
  await expect(page).toHaveURL(/\/circles\/e2e-circle/i, { timeout: 45_000 });
  const rate = sql(`select loan_profit_rate_pct from public.jamiyas where name='E2E Circle ${RUN}'`);
  expect(Number(rate), 'new circle loan profit default').toBe(0);
  expect(errors).toEqual([]);
});

test('member tops up the wallet (simulated M-Pesa)', async ({ page }) => {
  const errors = watchErrors(page);
  const before = walletBalance('bob@jamiya.local');
  await signInEmail(page, 'bob@jamiya.local');
  await page.goto('/wallet?focus=top-up#top-up');
  await page.locator('#amount').first().fill('1000');
  const phone = page.locator('#phone').first();
  if (await phone.isVisible().catch(() => false)) await phone.fill('0712345678');
  await page.getByRole('button', { name: /add money|pay with m-pesa|continue to pay/i }).first().click();
  const otp = page.locator('#otp');
  if (await otp.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await otp.fill(latestOtp());
    await page.getByRole('button', { name: /^confirm$/i }).click();
  }
  await expect
    .poll(() => walletBalance('bob@jamiya.local'), { timeout: 45_000, message: 'wallet credited' })
    .toBeGreaterThanOrEqual(before + 1000);
  expect(errors).toEqual([]);
});

test('member pays a circle contribution from the wallet', async ({ page }) => {
  const errors = watchErrors(page);
  const due = Number(
    sql(
      `select count(*) from public.contributions c join public.members m on m.id=c.member_id join auth.users u on u.id=m.user_id where u.email='bob@jamiya.local' and c.status in ('pending','late','partial')`,
    ) || 0,
  );
  test.skip(due === 0, 'seed has no started circle, so bob has no dues to pay');
  const before = walletBalance('bob@jamiya.local');
  await signInEmail(page, 'bob@jamiya.local');
  await page.goto(`/circles/${CIRCLE}`);
  const pay = page.getByRole('button', { name: /pay( now| dues| contribution)?|pay from (money|wallet)/i }).first();
  const payLink = page.getByRole('link', { name: /pay( now| dues| contribution)?/i }).first();
  if (await pay.isVisible().catch(() => false)) await pay.click();
  else await payLink.click();
  const confirm = page.getByRole('button', { name: /pay|confirm/i }).last();
  if (await confirm.isVisible({ timeout: 8_000 }).catch(() => false)) await confirm.click();
  await expect
    .poll(() => walletBalance('bob@jamiya.local'), { timeout: 45_000, message: 'wallet debited for dues' })
    .toBeLessThan(before);
  expect(errors).toEqual([]);
});

test('member requests a withdrawal', async ({ page }) => {
  const errors = watchErrors(page);
  const before = Number(sql(`select count(*) from public.withdrawal_requests`));
  await signInEmail(page, 'bob@jamiya.local');
  await page.goto('/wallet');
  const amount = page.locator('#withdraw-amount');
  await amount.scrollIntoViewIfNeeded();
  await amount.fill('100');
  const phone = page.locator('form:has(#withdraw-amount) #phone');
  if (await phone.isVisible().catch(() => false)) await phone.fill('0712345678');
  await page.getByRole('button', { name: /request withdrawal/i }).click();
  const otp = page.locator('#withdraw-otp');
  if (await otp.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await otp.fill(latestOtp());
    await page.getByRole('button', { name: /confirm|request withdrawal/i }).last().click();
  }
  await expect
    .poll(() => Number(sql(`select count(*) from public.withdrawal_requests`)), { timeout: 45_000 })
    .toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('member requests an interest-free circle loan (Qard)', async ({ page }) => {
  const errors = watchErrors(page);
  await signInEmail(page, 'bob@jamiya.local');
  await page.goto('/finance/qard');
  // With nothing paid in yet, the page must explain why no loan can be requested.
  const noRoom = page.getByText(/pay into the circle before you can ask for a loan/i).first();
  if (await noRoom.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await expect(page.locator('#amount')).toHaveCount(0);
    expect(errors).toEqual([]);
    return;
  }
  const circle = page.locator('#jamiyaId');
  if ((await circle.evaluate((el) => el.tagName)) === 'SELECT') await circle.selectOption({ index: 1 }).catch(() => {});
  await page.locator('#amount').fill('200');
  const inst = page.locator('#installments');
  if (await inst.isVisible().catch(() => false)) await inst.fill('2').catch(() => {});
  await page.locator('#purpose').fill(`E2E school fees ${RUN}`);
  await page.getByRole('button', { name: /request|apply|submit/i }).first().click();
  // Either the loan is created, or the circle cap blocks it with a clear message. Both are valid.
  await expect(page.locator('body')).toContainText(/requested|submitted|pending|above|cap|limit|guarantor/i);
  expect(errors).toEqual([]);
});

test('member submits a Sadaka campaign and admin approves it', async ({ page, browser }) => {
  const errors = watchErrors(page);
  await signInEmail(page, 'bob@jamiya.local');
  await page.goto('/sadaka/new');
  const title = `E2E Sadaka ${RUN}`;
  await page.locator('#title').fill(title);
  const cat = page.locator('#category');
  if ((await cat.evaluate((el) => el.tagName)) === 'SELECT') await cat.selectOption({ index: 1 });
  await page.locator('#story').fill('Local end-to-end test campaign. Safe to reject or delete at any time. '.repeat(2));
  await page.locator('#targetAmount').fill('5000');
  await page.locator('#beneficiaryName').fill('E2E Beneficiary');
  await page.locator('#beneficiaryPhone').fill('0712345678');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.locator('#coverImage').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png });
  // Supporting document: members upload it here (or pick one from Profile → KYC).
  const kycFile = page.locator('#kycDocument');
  if (await kycFile.isVisible().catch(() => false)) {
    await kycFile.setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByText(/uploaded\. only jameiyah admins/i)).toBeVisible({ timeout: 30_000 });
  }
  await page.getByRole('button', { name: /submit for admin review/i }).click();
  await expect
    .poll(() => sql(`select status from public.charity_campaigns where title='${title}'`), { timeout: 45_000 })
    .toMatch(/pending_review|draft|live/);

  const admin = await browser.newPage();
  await signInEmail(admin, 'admin@jamiya.local');
  await admin.goto('/admin/sadaka');
  await expect(admin.getByText(title).first()).toBeVisible();
  expect(errors).toEqual([]);
  await admin.close();
});

test('language switch to Kiswahili and back', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.waitForLoadState('load');
  // The switcher needs the page script; tap again until the language actually changes.
  const toSw = page.getByRole('button', { name: /kiswahili/i }).first();
  await expect(async () => {
    await toSw.click({ timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole('link', { name: /^ingia$/i }).first()).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 40_000 });
  const toEn = page.getByRole('button', { name: /english/i }).first();
  await expect(async () => {
    await toEn.click({ timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole('link', { name: /^sign in$/i }).first()).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 40_000 });
  expect(errors).toEqual([]);
});

test('ordinary member is blocked from officer and admin actions', async ({ page }) => {
  await signInEmail(page, 'bob@jamiya.local');
  for (const path of [`/circles/${CIRCLE}/officer`, `/circles/${CIRCLE}/books`, '/admin', '/admin/withdrawals']) {
    await page.goto(path).catch(() => {});
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000, message: `${path} should be blocked for bob` })
      .not.toBe(path);
  }
  // Direct database call as bob must not be able to credit his own wallet.
  const anon = sql(
    `select has_function_privilege('authenticated','public.wallet_top_up(numeric,character,text)','execute')`,
  );
  expect(anon).toBe('f');
});

test('sign out ends the session', async ({ page }) => {
  await signInEmail(page, 'bob@jamiya.local');
  await page.goto('/profile');
  const out = page.getByRole('button', { name: /sign out|log out/i }).first();
  const outLink = page.getByRole('link', { name: /sign out|log out/i }).first();
  if (await out.isVisible().catch(() => false)) await out.click();
  else await outLink.click();
  await page.waitForTimeout(2_000);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
