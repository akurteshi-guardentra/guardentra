#!/usr/bin/env node
/**
 * Post-push verify: prove guardentra.com is serving expected App Hosting chunks
 * without needing a valid Firebase CLI session.
 *
 * Usage:
 *   node scripts/verify-live-deploy.mjs
 *   npm run verify:live
 *   node scripts/verify-live-deploy.mjs --base https://guardentra.com
 *
 * Exit 0 = markers found; exit 1 = stale/missing deploy signals.
 */
import process from 'node:process';

const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : null) || process.env.GUARDENTRA_LIVE_URL || 'https://guardentra.com';

/**
 * Spine pages are eager inside AppAuthenticated (triage blank-page fix).
 * Dialogs may still be separate lazy chunks.
 */
const MARKERS = {
  authInline: [
    'Vendor Register',
    'Assessment Tracker',
    'Risk triage',
    'Vendor not found in this organization',
    'Opening review',
  ],
  optionalLazyHints: ['AddVendorDialog-', 'PageShell-'],
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function firstMatch(text, re) {
  const m = text.match(re);
  return m ? m[0] : null;
}

function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK    ${msg}`);
}

async function main() {
  console.log(`Live deploy probe → ${BASE}`);
  console.log(`Time  ${new Date().toISOString()}`);
  console.log('');

  const html = await fetchText(`${BASE}/`);
  const entry = firstMatch(html, /\/assets\/index-[^"'\\\s>]+\.js/);
  if (!entry) {
    fail('No hashed /assets/index-*.js in homepage HTML');
    return;
  }
  ok(`entry ${entry}`);

  const indexJs = await fetchText(`${BASE}${entry}`);
  const authChunk =
    firstMatch(indexJs, /\/assets\/AppAuthenticated-[^"'\\\s>]+\.js/) ||
    firstMatch(indexJs, /assets\/AppAuthenticated-[^"'\\\s>]+\.js/);
  if (!authChunk) {
    fail('AppAuthenticated chunk not referenced from entry');
    return;
  }
  const authUrl = authChunk.startsWith('/') ? `${BASE}${authChunk}` : `${BASE}/${authChunk}`;
  ok(`auth  ${authChunk}`);

  const authJs = await fetchText(authUrl);

  // Eager spine: triage must not be a separate lazy chunk anymore.
  if (/assets\/FastTrackTriage-[^"'\\\s>]+\.js/.test(authJs)) {
    fail('FastTrackTriage is still a separate lazy chunk (blank-page regression risk)');
  } else {
    ok('FastTrackTriage is eager (no separate lazy chunk)');
  }

  for (const needle of MARKERS.authInline) {
    if (!authJs.includes(needle)) fail(`auth bundle missing "${needle}"`);
    else ok(`auth contains "${needle}"`);
  }

  for (const hint of MARKERS.optionalLazyHints) {
    if (authJs.includes(hint)) ok(`auth graph has ${hint}*`);
    else ok(`note: ${hint}* not separate (may be inlined)`);
  }

  console.log('');
  if (process.exitCode) {
    console.error('Verdict: LIVE BUNDLE LOOKS STALE OR INCOMPLETE vs expected markers.');
    console.error('Check Firebase Console → App Hosting → backend guardentra → latest rollout.');
  } else {
    console.log('Verdict: live CDN serves expected triage + spine markers (deploy looks current).');
  }
}

main().catch((err) => {
  console.error('Probe error:', err?.message || err);
  process.exit(1);
});
