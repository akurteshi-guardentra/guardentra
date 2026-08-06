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

/** Unique markers from the spine polish / Suspense-fix commits. */
const MARKERS = {
  vendors: ['Vendor Register'],
  assessments: ['Assessment Tracker', 'Opening review'],
  authGraph: ['PageShell-', 'VendorsDirectory-', 'Assessments-', 'AddVendorDialog-'],
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

function allMatches(text, re) {
  return [...text.matchAll(re)].map((m) => m[0]);
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
  const authChunk = firstMatch(indexJs, /\/assets\/AppAuthenticated-[^"'\\\s>]+\.js/)
    || firstMatch(indexJs, /assets\/AppAuthenticated-[^"'\\\s>]+\.js/);
  if (!authChunk) {
    fail('AppAuthenticated chunk not referenced from entry');
    return;
  }
  const authUrl = authChunk.startsWith('/') ? `${BASE}${authChunk}` : `${BASE}/${authChunk}`;
  ok(`auth  ${authChunk}`);

  const authJs = await fetchText(authUrl);
  for (const needle of MARKERS.authGraph) {
    if (!authJs.includes(needle)) fail(`auth graph missing chunk hint: ${needle}`);
    else ok(`auth graph has ${needle}*`);
  }

  const vendorsRel = firstMatch(authJs, /assets\/VendorsDirectory-[^"'\\\s>]+\.js/);
  const assessRel = firstMatch(authJs, /assets\/Assessments-[^"'\\\s>]+\.js/);
  if (!vendorsRel) fail('VendorsDirectory chunk missing from auth graph');
  if (!assessRel) fail('Assessments chunk missing from auth graph');
  if (!vendorsRel || !assessRel) return;

  const vendorsJs = await fetchText(`${BASE}/${vendorsRel}`);
  const assessJs = await fetchText(`${BASE}/${assessRel}`);

  for (const m of MARKERS.vendors) {
    if (!vendorsJs.includes(m)) fail(`VendorsDirectory missing "${m}"`);
    else ok(`vendors contains "${m}"`);
  }
  for (const m of MARKERS.assessments) {
    if (!assessJs.includes(m)) fail(`Assessments missing "${m}"`);
    else ok(`assessments contains "${m}"`);
  }

  const pageShell = allMatches(authJs, /assets\/PageShell-[^"'\\\s>]+\.js/g);
  if (pageShell.length) ok(`PageShell chunk ${pageShell[0]}`);
  else fail('PageShell chunk not in auth graph');

  console.log('');
  if (process.exitCode) {
    console.error('Verdict: LIVE BUNDLE LOOKS STALE OR INCOMPLETE vs expected markers.');
    console.error('Check Firebase Console → App Hosting → backend guardentra → latest rollout.');
  } else {
    console.log('Verdict: live CDN serves expected polish markers (deploy looks current).');
  }
}

main().catch((err) => {
  console.error('Probe error:', err?.message || err);
  process.exit(1);
});
