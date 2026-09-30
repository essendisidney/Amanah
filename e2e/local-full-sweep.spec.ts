import { expect, test, type Page } from '@playwright/test';
import { signInEmail } from './helpers';
import { mkdirSync, appendFileSync } from 'node:fs';

/**
 * Full screen sweep against the LOCAL stack (scripts/dev-local.ps1 + local Supabase seed).
 * Every screen is opened as each role, on desktop and mobile. Records problems, never writes data.
 */

const CIRCLE = 'nairobi-sisters-circle';
const OUT = 'test-results/sweep';
mkdirSync(OUT, { recursive: true });

const PUBLIC = [
  '/', '/welcome', '/login', '/register', '/phone', '/forgot-password', '/pricing', '/shariah',
  '/sadaka', '/sadaka/jameiyah-community-relief', '/zakat', '/support', '/privacy', '/terms',
  '/invitations/not-a-real-code',
];

const MEMBER = [
  '/dashboard', '/circles', '/circles/new', '/wallet', '/pay', '/notifications', '/profile', '/help',
  '/finance', '/finance/goals', '/finance/insights', '/finance/invest', '/finance/qard',
  '/finance/tawarruq', '/finance/welfare', '/sadaka/my', '/sadaka/new', '/sadaka/adopt',
  `/circles/${CIRCLE}`, `/circles/${CIRCLE}/statement`, `/circles/${CIRCLE}/community`,
  `/circles/${CIRCLE}/elections`, `/circles/${CIRCLE}/next-of-kin`, `/circles/${CIRCLE}/shares`,
];

const OFFICER = [
  `/circles/${CIRCLE}/officer`, `/circles/${CIRCLE}/books`, `/circles/${CIRCLE}/arrears`,
  `/circles/${CIRCLE}/audit`, `/circles/${CIRCLE}/invoices`, `/circles/${CIRCLE}/journal`,
  `/circles/${CIRCLE}/registration`, `/circles/${CIRCLE}/report`, `/circles/${CIRCLE}/treasury`,
];

const ADMIN = [
  '/admin', '/admin/architecture', '/admin/audit', '/admin/circles', '/admin/collections',
  '/admin/disputes', '/admin/finance', '/admin/finance/accounts', '/admin/finance/approvals',
  '/admin/finance/integrity', '/admin/finance/journal', '/admin/finance/reconcile',
  '/admin/finance/refunds', '/admin/finance/settlements', '/admin/insights', '/admin/kyc',
  '/admin/observability', '/admin/playbooks', '/admin/risk', '/admin/sadaka', '/admin/support',
  '/admin/tawarruq', '/admin/transactions', '/admin/users', '/admin/withdrawals',
];

const CRASH = /Application error|client-side exception|Something went wrong|Unhandled Runtime Error|Internal Server Error|NEXT_REDIRECT|undefined is not|Cannot read propert/i;
const GARBLED = /â€|Ã©|�/;


type Row = {
  project: string; role: string; path: string; status: number; finalPath: string;
  problems: string[];
};

async function visit(page: Page, role: string, path: string, project: string): Promise<Row> {
  const problems: string[] = [];
  const pageErrors: string[] = [];
  const onErr = (e: Error) => pageErrors.push(e.message.slice(0, 160));
  page.on('pageerror', onErr);
  let status = 0;
  try {
    const res = await page.goto(path, { waitUntil: 'load', timeout: 60_000 });
    status = res?.status() ?? 0;
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  } catch (e) {
    problems.push(`load: ${String(e).slice(0, 120)}`);
  }
  await page.waitForTimeout(600);
  const finalPath = new URL(page.url()).pathname;
  const text = (await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '')) ?? '';
  if (status >= 500) problems.push(`HTTP ${status}`);
  const crash = text.match(CRASH);
  if (crash) problems.push(`crash text: "${crash[0]}"`);
  if (GARBLED.test(text)) problems.push('garbled characters');
  if (/amanah/i.test(text)) problems.push('old name "Amanah" visible');
  const overflow = await page
    .evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    .catch(() => 0);
  if (overflow > 2) problems.push(`sideways scroll ${overflow}px`);
  const brokenImgs = await page
    .evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length)
    .catch(() => 0);
  if (brokenImgs) problems.push(`${brokenImgs} broken image(s)`);
  const tiny = await page
    .evaluate(() =>
      [...document.querySelectorAll('button, a[href], [role="button"], input, select')]
        .filter((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32);
        }).length,
    )
    .catch(() => 0);
  if (project === 'mobile' && tiny > 6) problems.push(`${tiny} tap targets under 32px`);
  for (const e of pageErrors) problems.push(`js error: ${e}`);
  page.off('pageerror', onErr);
  const slug = `${project}-${role}-${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}`;
  await page.screenshot({ path: `${OUT}/${slug}.png`, timeout: 15_000 }).catch(() => {});
  const row = { project, role, path, status, finalPath, problems };
  appendFileSync(`${OUT}/results.jsonl`, JSON.stringify(row) + '\n');
  return row;
}

const PLAN: Array<{ role: string; email?: string; paths: string[]; blocked?: string[] }> = [
  { role: 'visitor', paths: PUBLIC, blocked: ['/dashboard', '/wallet', '/admin', `/circles/${CIRCLE}/officer`] },
  { role: 'member-bob', email: 'bob@jamiya.local', paths: MEMBER, blocked: [...ADMIN.slice(0, 4), ...OFFICER.slice(0, 3)] },
  { role: 'officer-alice', email: 'alice@jamiya.local', paths: [...MEMBER.filter((p) => p.includes(CIRCLE)), ...OFFICER] },
  { role: 'admin', email: 'admin@jamiya.local', paths: ADMIN },
  { role: 'compliance', email: 'compliance@jamiya.local', paths: ['/admin', '/admin/kyc', '/admin/withdrawals', '/admin/sadaka', '/admin/risk'] },
];

for (const plan of PLAN) {
  test(`every screen loads cleanly: ${plan.role}`, async ({ page }, info) => {
    test.setTimeout(20 * 60_000);
    if (plan.email) await signInEmail(page, plan.email);
    const bad: string[] = [];
    for (const path of plan.paths) {
      const row = await visit(page, plan.role, path, info.project.name);
      if (row.problems.length) bad.push(`${path}: ${row.problems.join('; ')}`);
    }
    for (const path of plan.blocked ?? []) {
      // A blocked page often redirects mid-navigation (ERR_ABORTED); that is the expected outcome.
      await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1_500);
      // Server redirects can land a moment after 'load' on a slow machine; give it time.
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).not.toBe(path).catch(() => {});
      const finalPath = new URL(page.url()).pathname;
      if (finalPath === path) bad.push(`${path}: NOT blocked for ${plan.role}`);
    }
    expect.soft(bad, bad.join('\n')).toEqual([]);
  });
}
