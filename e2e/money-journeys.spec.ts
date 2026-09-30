import { expect, test, type Page } from '@playwright/test';
import { signInEmail } from './helpers';
import { execSync } from 'node:child_process';

/**
 * Full money journeys on the LOCAL stack only (simulated payments, seeded users):
 * activate a circle, pay a contribution from the wallet, then a Qard loan from
 * request to agreement, officer approval and repayment. Checks the books balance.
 */

const CIRCLE = 'nairobi-sisters-circle';
const BOB = 'bob@jamiya.local';
const ALICE = 'alice@jamiya.local';
const RUN = Date.now().toString(36);

function sql(query: string): string {
  // One line only: Windows cmd drops everything after a newline in the command.
  const q = query.replace(/\s+/g, ' ').replace(/"/g, '\\"');
  return execSync(`docker exec supabase_db_jamiya psql -U postgres -tAc "${q}"`, {
    encoding: 'utf8',
  }).trim();
}

const num = (q: string) => Number(sql(q) || 0);
const circleId = () => sql(`select id from public.jamiyas where slug='${CIRCLE}'`);
const bobId = () => sql(`select id from auth.users where email='${BOB}'`);
const wallet = (email: string) =>
  num(`select coalesce(sum(w.available_balance),0) from public.wallets w join auth.users u on u.id=w.user_id where u.email='${email}'`);

/** Every journal entry must balance: debits equal credits. */
function unbalancedEntries(): number {
  return num(`select count(*) from (select journal_entry_id from public.journal_lines
    group by journal_entry_id having sum(case when side='debit' then amount else 0 end)
    <> sum(case when side='credit' then amount else 0 end)) x`);
}

function latestOtp(): string {
  return sql(`select code from public.otp_codes order by created_at desc limit 1`);
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function topUp(page: Page, amount: number) {
  const before = wallet(BOB);
  await page.goto('/wallet?focus=top-up#top-up');
  await page.locator('#amount').first().fill(String(amount));
  const phone = page.locator('#phone').first();
  if (await phone.isVisible().catch(() => false)) await phone.fill('0712345678');
  await page.getByRole('button', { name: /add money|pay with m-pesa|continue to pay/i }).first().click();
  const otp = page.locator('#otp');
  if (await otp.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await otp.fill(latestOtp());
    await page.getByRole('button', { name: /^confirm$/i }).click();
  }
  await expect.poll(() => wallet(BOB), { timeout: 45_000, message: 'top-up credited' }).toBeGreaterThanOrEqual(before + amount);
}

test.describe.configure({ mode: 'serial' });
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'money journeys run once, on desktop');
});

test('officer activates the circle and the schedule is generated', async ({ page }) => {
  const errors = watchErrors(page);
  if (sql(`select status from public.jamiyas where slug='${CIRCLE}'`) !== 'active') {
    await signInEmail(page, ALICE);
    const button = page.getByRole('button', { name: /activate circle/i });
    for (const path of [`/circles/${CIRCLE}`, `/circles/${CIRCLE}/officer`, `/circles/${CIRCLE}/schedule`]) {
      await page.goto(path);
      if (await button.isVisible({ timeout: 5_000 }).catch(() => false)) break;
    }
    await button.click();
    await expect
      .poll(() => sql(`select status from public.jamiyas where slug='${CIRCLE}'`), { timeout: 30_000 })
      .toBe('active');
  }
  const scheduled = num(`select count(*) from public.contributions where jamiya_id='${circleId()}'`);
  expect(scheduled, 'contributions scheduled for members').toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('member pays the next contribution from the wallet, exactly once', async ({ page }) => {
  const errors = watchErrors(page);
  const next = sql(`select c.id||'|'||(c.amount-coalesce(c.amount_paid,0)) from public.contributions c
    join public.members m on m.id=c.member_id where m.user_id='${bobId()}' and c.jamiya_id='${circleId()}'
    and c.status in ('pending','late','partial') order by c.due_date, c.cycle_number limit 1`);
  test.skip(!next, 'bob has nothing left to pay in this circle');
  const [contributionId, dueRaw] = next.split('|');
  const due = Number(dueRaw);

  await signInEmail(page, BOB);
  if (wallet(BOB) < due) await topUp(page, Math.ceil(due - wallet(BOB)) + 100);
  const before = wallet(BOB);

  await page.goto(`/circles/${CIRCLE}`);
  // "Pay Ksh …" when due, "Pay ahead Ksh …" before the due date. Both pay from the Money balance.
  await page.getByRole('button', { name: /^pay( ahead)? (ksh|kes)/i }).first().click();
  await expect
    .poll(() => sql(`select status from public.contributions where id='${contributionId}'`), { timeout: 30_000 })
    .toBe('paid');
  // Double submit guard: the same contribution must not be charged twice.
  const after = wallet(BOB);
  expect(before - after, 'wallet debited by the contribution').toBeGreaterThanOrEqual(due);
  expect(before - after, 'no double charge').toBeLessThan(due * 2);
  expect(unbalancedEntries(), 'every journal entry balances').toBe(0);
  expect(errors).toEqual([]);
});

test('Qard: request, agreement, officer approval, repayment', async ({ page, browser }) => {
  const errors = watchErrors(page);
  const jid = circleId();
  const purpose = `E2E school fees ${RUN}`;

  // 1. Member asks for a loan.
  await signInEmail(page, BOB);
  await page.goto(`/finance/qard?jamiyaId=${jid}`);
  const circle = page.locator('#jamiyaId');
  if ((await circle.count()) && (await circle.evaluate((el) => el.tagName)) === 'SELECT') {
    await circle.selectOption(jid).catch(() => {});
  }
  await page.locator('#amount').fill('1000');
  const inst = page.locator('#installments');
  if (await inst.isVisible().catch(() => false)) await inst.fill('2');
  await page.locator('#purpose').fill(purpose);
  await page.getByRole('button', { name: /send request|request loan/i }).first().click();
  await expect
    .poll(() => sql(`select status from public.qard_loans where purpose='${purpose}'`), {
      timeout: 30_000,
      message: 'loan requested',
    })
    .toBe('requested');
  const loanId = sql(`select id from public.qard_loans where purpose='${purpose}'`);

  // 2. Member signs the agreement.
  await page.goto(`/finance/qard?jamiyaId=${jid}`);
  const agreement = page.locator(`form:has(input[name="loanId"][value="${loanId}"]):has(input[name="signerName"])`).first();
  await agreement.locator('input[name="signerName"]').fill('Bob Member');
  await agreement.getByRole('button', { name: /accept agreement/i }).click();
  await expect
    .poll(() => sql(`select agreement_accepted_at is not null from public.qard_loans where id='${loanId}'`), { timeout: 30_000 })
    .toBe('t');

  // 3. Officer sees it in the officer queue and approves it.
  const officerCtx = await browser.newContext();
  const officer = await officerCtx.newPage();
  const officerErrors = watchErrors(officer);
  await signInEmail(officer, ALICE);
  await officer.goto(`/circles/${CIRCLE}/officer`);
  await expect(officer.locator('body'), 'officer queue lists the loan request').toContainText(/1,000/);
  await officer.goto(`/finance/qard?jamiyaId=${jid}`);
  const approve = officer
    .locator(`form:has(input[name="loanId"][value="${loanId}"]):has(input[name="approve"][value="true"])`)
    .first();
  const walletBeforeDisburse = wallet(BOB);
  await approve.getByRole('button').click();
  await expect
    .poll(() => sql(`select status from public.qard_loans where id='${loanId}'`), { timeout: 30_000 })
    .toBe('active');
  expect(wallet(BOB), 'loan paid into the member wallet').toBeGreaterThanOrEqual(walletBeforeDisburse + 1000);
  await officerCtx.close();

  // 4. Member repays part of it.
  await page.goto(`/finance/qard?jamiyaId=${jid}`);
  const repay = page.locator(`form:has(input[name="loanId"][value="${loanId}"]):has(input[name="amount"])`).first();
  await repay.locator('input[name="amount"]').fill('500');
  await repay.getByRole('button', { name: /repay/i }).click();
  await expect
    .poll(() => num(`select amount_repaid from public.qard_loans where id='${loanId}'`), { timeout: 30_000 })
    .toBe(500);

  expect(unbalancedEntries(), 'every journal entry balances').toBe(0);
  expect([...errors, ...officerErrors]).toEqual([]);
});
