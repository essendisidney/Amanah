// Live-site UI sweep for jameiyah.com. Run: node scripts/ui-sweep.mjs
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'https://jameiyah.com';
const OUT = process.env.OUT_DIR ?? 'ui-sweep';
mkdirSync(OUT, { recursive: true });

const pages = [
  '/', '/welcome', '/login', '/register', '/phone', '/forgot-password',
  '/pricing', '/shariah', '/sadaka', '/zakat', '/support', '/privacy', '/terms',
  '/dashboard', '/circles', '/wallet', '/circles/new', '/definitely-not-a-page',
];

const profiles = [
  { name: 'desktop', ctx: { viewport: { width: 1366, height: 900 } } },
  { name: 'mobile', ctx: { ...devices['Pixel 7'] } },
];

const browser = await chromium.launch(
  process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {},
);
const report = [];
for (const prof of profiles) {
  const context = await browser.newContext(prof.ctx);
  for (const path of pages) {
    const page = await context.newPage();
    const errors = [];
    const failed = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    page.on('response', (r) => {
      const u = r.url();
      if (r.status() >= 400 && u.startsWith(BASE)) failed.push(`${r.status()} ${u.replace(BASE, '')}`);
    });
    let status = 0;
    let finalPath = '';
    try {
      const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
      status = res?.status() ?? 0;
      finalPath = new URL(page.url()).pathname;
    } catch (e) {
      errors.push(`goto: ${String(e).slice(0, 160)}`);
    }
    await page.waitForTimeout(800);
    const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    const html = await page.content().catch(() => '');
    const overflowX = await page
      .evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      .catch(() => 0);
    const brokenImgs = await page
      .evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src))
      .catch(() => []);
    const title = await page.title().catch(() => '');
    const slug = path === '/' ? 'home' : path.replace(/\//g, '_').replace(/^_/, '');
    await page.screenshot({ path: `${OUT}/${prof.name}-${slug}.png`, fullPage: false }).catch(() => {});
    report.push({
      profile: prof.name,
      path,
      status,
      finalPath,
      title,
      amanahMentions: (html.match(/amanah/gi) ?? []).length,
      mojibake: (text.match(/â€|Ã©|�/g) ?? []).length,
      overflowX,
      brokenImgs,
      failed: [...new Set(failed)].slice(0, 8),
      consoleErrors: [...new Set(errors)].slice(0, 6),
      textStart: text.replace(/\s+/g, ' ').slice(0, 140),
    });
    await page.close();
  }
  await context.close();
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
for (const r of report) {
  const flags = [
    r.status >= 400 ? `HTTP ${r.status}` : '',
    r.finalPath && r.finalPath !== r.path ? `-> ${r.finalPath}` : '',
    r.amanahMentions ? `amanah x${r.amanahMentions}` : '',
    r.mojibake ? `garbled x${r.mojibake}` : '',
    r.overflowX > 2 ? `h-scroll ${r.overflowX}px` : '',
    r.brokenImgs.length ? `broken img x${r.brokenImgs.length}` : '',
    r.failed.length ? `failed: ${r.failed.join(', ')}` : '',
    r.consoleErrors.length ? `console: ${r.consoleErrors.join(' | ')}` : '',
  ].filter(Boolean).join('; ');
  console.log(`${r.profile.padEnd(7)} ${r.path.padEnd(24)} ${flags || 'ok'}`);
}
