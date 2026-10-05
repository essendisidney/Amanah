#!/usr/bin/env node
/**
 * Database tests (pgTAP) against a throwaway Postgres in Docker.
 * Applies every migration in order, then runs supabase/tests/database/*.test.sql.
 * Needs only Docker (psql runs inside the container).
 *
 * Usage:
 *   node scripts/test-db.mjs              # fresh container, removed afterwards
 *   node scripts/test-db.mjs --keep       # leave the container running to poke at
 *   node scripts/test-db.mjs complete_payment_intent   # only matching test files
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE = process.env.TEST_DB_IMAGE ?? 'supabase/postgres:15.8.1.085';
const NAME = process.env.TEST_DB_CONTAINER ?? 'jameiyah-test-db';
const args = process.argv.slice(2);
const keep = args.includes('--keep');
const filters = args.filter((a) => !a.startsWith('--'));
// The container is throwaway, so it gets a fresh password each run instead of a fixed one.
const PASSWORD = randomBytes(18).toString('base64url');

function docker(...cmd) {
  return execFileSync('docker', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function psql(sql, { user = 'postgres', quiet = true } = {}) {
  const res = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      '-e',
      `PGPASSWORD=${PASSWORD}`,
      NAME,
      'psql',
      '-h',
      '127.0.0.1',
      '-U',
      user,
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      ...(quiet ? ['-q'] : []),
    ],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return { ok: res.status === 0, out: res.stdout ?? '', err: res.stderr ?? '' };
}

function sqlFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(dir, f));
}

function startDb() {
  spawnSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
  docker('run', '-d', '--name', NAME, '-e', `POSTGRES_PASSWORD=${PASSWORD}`, IMAGE);
  // The image restarts Postgres once after its init scripts, so wait for two good checks in a row.
  let good = 0;
  for (let i = 0; i < 90 && good < 2; i++) {
    const r = spawnSync('docker', [
      'exec',
      NAME,
      'pg_isready',
      '-U',
      'postgres',
      '-h',
      '127.0.0.1',
    ]);
    good = r.status === 0 ? good + 1 : 0;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  if (good < 2) throw new Error('Postgres did not become ready');
}

function migrate() {
  const shim = psql(readFileSync(join(ROOT, 'scripts/test-db-shim.sql'), 'utf8'), {
    user: 'supabase_admin',
  });
  if (!shim.ok) throw new Error(`shim failed:\n${shim.err}`);
  const files = sqlFiles(join(ROOT, 'supabase/migrations'));
  for (const f of files) {
    const r = psql(readFileSync(f, 'utf8'));
    if (!r.ok) throw new Error(`migration failed: ${f}\n${r.err}`);
  }
  console.log(`applied ${files.length} migrations`);
}

function runTests() {
  const files = sqlFiles(join(ROOT, 'supabase/tests/database')).filter(
    (f) => filters.length === 0 || filters.some((x) => f.includes(x)),
  );
  let failed = 0;
  for (const f of files) {
    const r = psql(readFileSync(f, 'utf8'));
    const lines = r.out.split('\n');
    const bad = lines.filter((l) => l.startsWith('not ok') || l.startsWith('# Looks like'));
    const passed = lines.filter((l) => l.startsWith('ok ')).length;
    const name = f.slice(ROOT.length + 1);
    if (!r.ok || bad.length) {
      failed++;
      console.log(`FAIL ${name} (${passed} passed)`);
      for (const l of bad) console.log(`  ${l}`);
      const errs = r.err.split('\n').filter((l) => /ERROR|DETAIL|CONTEXT/.test(l));
      for (const l of errs.slice(0, 10)) console.log(`  ${l}`);
    } else {
      console.log(`ok   ${name} (${passed} passed)`);
    }
  }
  return failed;
}

let failed = 1;
try {
  startDb();
  migrate();
  failed = runTests();
} catch (e) {
  console.error(e.message);
} finally {
  if (keep) console.log(`container ${NAME} left running: docker exec -it ${NAME} psql -U postgres`);
  else spawnSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
}
process.exit(failed ? 1 : 0);
