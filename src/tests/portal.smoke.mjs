/**
 * LIVE portal-evidence smoke test — runs against a REAL Firebase project, not the emulator.
 *
 * Companion to src/tests/storage.rules.test.mjs (which covers the same rules in the
 * emulator). This one exists because the emulator can't prove the cross-service
 * firestore.get() in storage.rules resolves correctly against a real database, real
 * IAM, and the real `(default)` vs named-DB question — see docs/KNOWN_ISSUES.md #1/#16.
 *
 * Prerequisites (all of docs/KNOWN_ISSUES.md #16):
 *   1. Anonymous Authentication enabled on the target project.
 *   2. Current firestore.rules + storage.rules deployed to it.
 *   3. .env.local contains VITE_FIREBASE_API_KEY for that project.
 *   4. Two assessment docs exist — one with portalOpen: true, one the anonymous
 *      session must NOT be able to touch. Create them through the app (an org
 *      member has to, anonymous users can't create assessments by design).
 *
 * Usage:
 *   node src/tests/portal.smoke.mjs --open <assessmentId> --other <assessmentId>
 *
 * Writes one small file to portal/<open>/ and attempts one write to portal/<other>/.
 * Point it at a demo/dev project, never prod.
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const openId = arg('open');
// Defaults to an id that cannot exist, which is the same rules outcome as a closed
// assessment (isOpenPortalAssessment() is false either way) — so the gating deny check
// still runs even without a real closed assessment on hand.
const closedId = arg('closed') || `__nonexistent_${Date.now()}`;
const otherOpenId = arg('other-open');
if (!openId) {
  console.error(
    'Usage: node src/tests/portal.smoke.mjs --open <assessmentId> [--closed <assessmentId>] [--other-open <assessmentId>]\n' +
      '  --open        an assessment with portalOpen: true (the allow path)\n' +
      '  --closed      an assessment with portalOpen: false (gating deny; defaults to a nonexistent id)\n' +
      '  --other-open  a second portalOpen: true assessment (probes KNOWN_ISSUES #17)',
  );
  process.exit(2);
}

// Same resolution order as src/firebase.ts: explicit env wins, applet config fills the rest.
const applet = JSON.parse(readFileSync(new URL('../../firebase-applet-config.json', import.meta.url), 'utf8'));
let envApiKey = process.env.VITE_FIREBASE_API_KEY;
if (!envApiKey) {
  try {
    const envLocal = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
    // Strip surrounding quotes the way dotenv/Vite do — a quoted value in .env.local is
    // valid and works in the app, so this parser must not pass the quotes through.
    envApiKey = envLocal
      .match(/^\s*VITE_FIREBASE_API_KEY\s*=\s*(.+?)\s*$/m)?.[1]
      ?.replace(/^(['"])(.*)\1$/, '$2')
      .trim();
  } catch {
    /* no .env.local — fall through to the error below */
  }
}
if (!envApiKey) {
  console.error('Missing VITE_FIREBASE_API_KEY (env or .env.local). See docs/SECRETS.md.');
  process.exit(2);
}

const firestoreDatabaseId = process.env.VITE_FIRESTORE_DATABASE_ID || applet.firestoreDatabaseId;
const app = initializeApp({ ...applet, apiKey: envApiKey });
const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
const storage = getStorage(app);

const results = [];
function record(name, passed, detail, informational = false) {
  results.push({ name, passed, detail, informational });
  const tag = informational ? (passed ? 'OK  ' : 'GAP ') : passed ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Expect the operation to succeed. */
async function expectAllow(name, fn) {
  try {
    await fn();
    record(name, true);
  } catch (err) {
    record(name, false, `unexpectedly denied: ${err?.code || err?.message}`);
  }
}

/** Expect the operation to be rejected by rules (not by a network/config error). */
async function expectDeny(name, fn, informational = false) {
  try {
    await fn();
    record(name, false, 'was ALLOWED — rules are not scoping this path', informational);
  } catch (err) {
    const code = err?.code || '';
    const isPermissionError = /unauthorized|permission-denied|storage\/unauthorized/.test(code);
    record(
      name,
      isPermissionError,
      isPermissionError ? `denied (${code})` : `denied, but with an unexpected error: ${code || err?.message}`,
      informational,
    );
  }
}

const stamp = `smoke-${Date.now()}.pdf`;
const payload = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-" so the contentType check is honest
const meta = { contentType: 'application/pdf' };

console.log(`\nProject: ${applet.projectId}  DB: ${firestoreDatabaseId || '(default)'}\n`);

const cred = await signInAnonymously(getAuth(app)).catch((err) => {
  console.error(
    `\nCould not sign in anonymously (${err?.code}).` +
      '\nIf this is auth/operation-not-allowed, Anonymous Authentication is still disabled' +
      '\non this project — Console → Authentication → Sign-in method → Anonymous → Enable.\n',
  );
  process.exit(1);
});
console.log(`Signed in anonymously as ${cred.user.uid}\n`);

await expectAllow('read own OPEN assessment doc', () => getDoc(doc(db, 'assessments', openId)));

await expectAllow('upload evidence to own portal path', () =>
  uploadBytes(ref(storage, `portal/${openId}/${stamp}`), payload, meta),
);

await expectAllow('read back own uploaded evidence', () =>
  getDownloadURL(ref(storage, `portal/${openId}/${stamp}`)),
);

// Gating deny: an assessment this session must not reach because it is not open
// (closed, or nonexistent — both make isOpenPortalAssessment() false).
await expectDeny('upload to a CLOSED/unknown assessment\'s portal path', () =>
  uploadBytes(ref(storage, `portal/${closedId}/${stamp}`), payload, meta),
);

// Informational — docs/KNOWN_ISSUES.md #17. The rules ask "is this assessment open",
// never "is this *your* assessment", so any *other* currently-open assessment is
// reachable by any anonymous session. Expect a GAP line here until portal sessions
// carry a portalAssessmentId claim. This is the realistic case in production, where
// every in-flight assessment is portalOpen: true.
if (otherOpenId) {
  await expectDeny(
    "upload to a DIFFERENT but also-OPEN assessment's portal path (KNOWN_ISSUES #17)",
    () => uploadBytes(ref(storage, `portal/${otherOpenId}/${stamp}`), payload, meta),
    true,
  );
}

// Informational only — this is docs/KNOWN_ISSUES.md #18, a known-and-deferred gap:
// the legacy orgs/.../evidence/ path still has a bare isSignedIn() rule. Expect a GAP
// line here until #18 is closed; it does not gate the smoke result.
await expectDeny(
  'write to the legacy unscoped org evidence path (KNOWN_ISSUES #18)',
  () => uploadBytes(ref(storage, `orgs/smoke-org/vendors/smoke-vendor/evidence/${stamp}`), payload, meta),
  true,
);

const gating = results.filter((r) => !r.informational);
const failed = gating.filter((r) => !r.passed);
console.log(`\n${gating.length - failed.length}/${gating.length} gating checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
}
const gaps = results.filter((r) => r.informational && !r.passed);
if (gaps.length) {
  console.log(`\nKnown gaps still present (not gating): ${gaps.length}`);
}
process.exit(failed.length ? 1 : 0);
