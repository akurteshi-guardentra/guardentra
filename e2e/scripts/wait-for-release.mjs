#!/usr/bin/env node
/**
 * Wait until the target's /api/health reports sourceSha == E2E_EXPECT_SHA.
 * App Hosting builds and rolls out a few minutes after deploy/staging moves, so the
 * suites must not start on the old build. GET only.
 *   E2E_TARGET=staging E2E_EXPECT_SHA=<sha> node scripts/wait-for-release.mjs [--timeout-min 40]
 * Exit 0 when served, 1 on timeout, 2 on bad input.
 */
import { resolveTarget, expectedSha } from '../lib/targets.mjs';

const i = process.argv.indexOf('--timeout-min');
const timeoutMin = i > -1 ? Number(process.argv[i + 1]) : 40;
let target, sha;
try {
  target = resolveTarget();
  sha = expectedSha();
  if (!sha) throw new Error('E2E_EXPECT_SHA is required');
} catch (e) { console.error(e.message); process.exit(2); }

const deadline = Date.now() + timeoutMin * 60_000;
let last = null;
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${target.baseURL}/api/health`, {
      headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000),
    });
    const body = res.ok ? await res.json() : null;
    last = body?.release?.sourceSha ?? `HTTP ${res.status}`;
    if (last === sha) {
      console.log(`${target.name} is serving ${sha} (revision ${body.release.revision ?? 'n/a'})`);
      process.exit(0);
    }
  } catch (e) { last = e.name; }
  console.log(`waiting: ${target.name} serves ${last}, want ${sha.slice(0, 12)}`);
  await new Promise((r) => setTimeout(r, 30_000));
}
console.error(`Timed out after ${timeoutMin} min; ${target.name} still serves ${last}.`);
process.exit(1);
