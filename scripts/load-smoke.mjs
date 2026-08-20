#!/usr/bin/env node
/**
 * Light concurrency smoke against public + health endpoints.
 * Usage:
 *   node scripts/load-smoke.mjs
 *   BASE_URL=https://amanah-liart.vercel.app CONCURRENCY=20 REQUESTS=100 node scripts/load-smoke.mjs
 */

const BASE = (process.env.BASE_URL ?? 'https://amanah-liart.vercel.app').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 12));
const REQUESTS = Math.max(CONCURRENCY, Number(process.env.REQUESTS ?? 60));

const PATHS = [
  '/api/v1/health',
  '/',
  '/pricing',
  '/login',
  '/phone',
  '/sadaka',
];

async function hit(path) {
  const started = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'user-agent': 'amanah-load-smoke/1.0' },
      redirect: 'manual',
    });
    const ms = Math.round(performance.now() - started);
    return { path, status: res.status, ms, ok: res.status >= 200 && res.status < 500 };
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    return {
      path,
      status: 0,
      ms,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const queue = Array.from({ length: REQUESTS }, (_, i) => PATHS[i % PATHS.length]);
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const index = cursor++;
      const path = queue[index];
      results.push(await hit(path));
    }
  }

  const started = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const elapsed = Math.round(performance.now() - started);

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const byPath = {};
  for (const row of results) {
    byPath[row.path] ??= { ok: 0, fail: 0, ms: [] };
    byPath[row.path].ms.push(row.ms);
    if (row.ok) byPath[row.path].ok += 1;
    else byPath[row.path].fail += 1;
  }

  console.log(
    JSON.stringify(
      {
        base: BASE,
        concurrency: CONCURRENCY,
        requests: REQUESTS,
        elapsed_ms: elapsed,
        ok,
        fail,
        p50_ms: p50,
        p95_ms: p95,
        failures: results
          .filter((r) => !r.ok)
          .slice(0, 8)
          .map((r) => ({ path: r.path, status: r.status, error: r.error ?? null })),
        by_path: Object.fromEntries(
          Object.entries(byPath).map(([path, stats]) => [
            path,
            {
              ok: stats.ok,
              fail: stats.fail,
              p50_ms: stats.ms.sort((a, b) => a - b)[Math.floor(stats.ms.length * 0.5)] ?? 0,
            },
          ]),
        ),
      },
      null,
      2,
    ),
  );

  if (fail > 0) process.exitCode = 1;
}

main();
