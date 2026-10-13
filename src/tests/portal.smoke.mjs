/**
 * STAGING-ONLY portal evidence smoke using existing synthetic assessments.
 * Not proof of answer persistence, submission, reviewer decisions or scanning.
 *
 * Required: PORTAL_API_BASE=https://guardentra--guardentra-staging.us-east4.hosted.app
 * and VITE_FIREBASE_API_KEY supplied privately for staging.
 * node src/tests/portal.smoke.mjs --project guardentra-staging --open <synthetic-id>
 *   --closed <closed-or-nonexistent-id> --other-open <second-open-id> --allow-test-upload
 *
 * Successful uploads remain for owner cleanup: portal clients cannot delete them.
 * Failed denial probes may also leave objects. Never use customer fixtures.
 * CI runs only syntax/preflight tests, never this live upload flow.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function arg(name) {
  const index = process.argv.indexOf('--' + name);
  return index > -1 ? process.argv[index + 1] : undefined;
}
const PROJECT = 'guardentra-staging';
const API_BASE = 'https://guardentra--guardentra-staging.us-east4.hosted.app';
const openId = arg('open');
const closedId = arg('closed');
const otherOpenId = arg('other-open');
function stop(message) {
  console.error(message);
  process.exit(2);
}
if (!process.argv.includes('--allow-test-upload')) {
  stop('Live test uploads require --allow-test-upload; use only existing synthetic fixtures.');
}
if (arg('project') !== PROJECT || process.env.PORTAL_API_BASE !== API_BASE) {
  stop('Explicit staging project and current us-east4 PORTAL_API_BASE are required.');
}
const ids = [openId, closedId, otherOpenId];
if (ids.some(id => !id || id.length > 128 || /[/.\s]/.test(id)) || new Set(ids).size !== 3) {
  stop('Provide distinct valid --open, --closed and --other-open synthetic assessment IDs.');
}
for (const name of ['VITE_FIREBASE_PROJECT_ID', 'GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[name] && process.env[name] !== PROJECT) stop('Conflicting Firebase project override.');
}
if (process.env.VITE_FIRESTORE_DATABASE_ID && process.env.VITE_FIRESTORE_DATABASE_ID !== '(default)') {
  stop('This staging smoke requires the (default) Firestore database.');
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  stop('Emulator overrides are not permitted in this live staging smoke.');
}
const apiKey = process.env.VITE_FIREBASE_API_KEY;
if (!apiKey || !apiKey.trim()) stop('Missing explicit staging VITE_FIREBASE_API_KEY.');

const allowedErrorCodes = new Set([
  'permission-denied', 'storage/unauthorized', 'auth/operation-not-allowed',
  'auth/invalid-custom-token', 'auth/custom-token-mismatch', 'auth/network-request-failed',
  'storage/retry-limit-exceeded', 'unavailable',
]);
function safeErrorCode(error) {
  return allowedErrorCodes.has(error?.code) ? error.code : 'UNEXPECTED_ERROR';
}
// sourceSha may be null; this does not establish exact deployment commit identity.
try {
  const response = await fetch(API_BASE + '/api/health', {
    redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('HEALTH_FAILED');
  const health = await response.json();
  if (health.status !== 'ok' || health.release?.environment !== 'staging' ||
      health.release?.projectId !== PROJECT || health.release?.service !== 'guardentra') {
    throw new Error('HEALTH_IDENTITY_MISMATCH');
  }
} catch {
  stop('Staging health/identity preflight failed; no portal session or upload attempted.');
}
async function openSessionToken(assessmentId) {
  const response = await fetch(API_BASE + '/api/portal/session', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assessmentId }),
  });
  if (!response.ok) throw new Error('PORTAL_SESSION_FAILED');
  const session = await response.json();
  if (typeof session.token !== 'string' || !session.token || session.branding?.portalOpen !== true) {
    throw new Error('OPEN_FIXTURE_INVALID');
  }
  return session.token;
}
// Verify the other fixture is actually open; do not sign in using its token.
try {
  await openSessionToken(otherOpenId);
} catch {
  stop('Second OPEN fixture could not be verified; no Firebase sign-in or upload attempted.');
}
const app = initializeApp({
  apiKey, projectId: PROJECT, authDomain: 'guardentra-staging.firebaseapp.com',
  storageBucket: 'guardentra-staging.firebasestorage.app',
  appId: '1:965959469996:web:25526a3a432460c6ef0809', messagingSenderId: '965959469996',
});
const db = getFirestore(app);
const storage = getStorage(app);
const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log((passed ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
}
async function expectAllow(name, operation) {
  try { await operation(); record(name, true); }
  catch (error) { record(name, false, 'unexpected failure: ' + safeErrorCode(error)); }
}
async function expectDeny(name, operation) {
  try { await operation(); record(name, false, 'was ALLOWED — rules are not scoping this path'); }
  catch (error) {
    const code = safeErrorCode(error);
    const denied = code === 'permission-denied' || code === 'storage/unauthorized';
    record(name, denied, denied ? 'denied (' + code + ')' : 'unexpected failure: ' + code);
  }
}
console.log('\nProject: ' + PROJECT + '  DB: (default)  API: ' + API_BASE + '\n');
try {
  const token = await openSessionToken(openId);
  const credential = await signInWithCustomToken(getAuth(app), token);
  const identity = await credential.user.getIdTokenResult();
  if (identity.claims.portalAssessmentId !== openId) throw new Error('PORTAL_CLAIM_MISMATCH');
} catch (error) {
  console.error('Scoped portal session failed: ' + safeErrorCode(error) + '; anonymous fallback is disabled.');
  process.exit(1);
}
console.log('Signed in [mode: scoped-token]\n');
await expectAllow('read own OPEN assessment doc', async () => {
  const snapshot = await getDoc(doc(db, 'assessments', openId));
  if (!snapshot.exists() || snapshot.data().portalOpen !== true) throw new Error('OPEN_FIXTURE_INVALID');
});
await expectDeny('read different assessment doc', () => getDoc(doc(db, 'assessments', otherOpenId)));
if (results.some(result => !result.passed)) {
  console.error('Firestore scope/fixture check failed; no Storage uploads attempted.');
  process.exit(1);
}
const stamp = 'smoke-' + Date.now() + '.pdf';
const payload = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const metadata = { contentType: 'application/pdf' };
const paths = [
  'portal/' + openId + '/' + stamp,
  'portal/' + closedId + '/' + stamp,
  'portal/' + otherOpenId + '/' + stamp,
  'orgs/smoke-org/vendors/smoke-vendor/evidence/' + stamp,
];
await expectAllow('upload evidence to own portal path', () => uploadBytes(ref(storage, paths[0]), payload, metadata));
await expectAllow('read back own uploaded evidence', () => getDownloadURL(ref(storage, paths[0])));
await expectDeny('upload to CLOSED/unknown assessment portal path', () => uploadBytes(ref(storage, paths[1]), payload, metadata));
await expectDeny('upload to DIFFERENT also-OPEN assessment portal path', () => uploadBytes(ref(storage, paths[2]), payload, metadata));
await expectDeny('write to legacy org evidence path', () => uploadBytes(ref(storage, paths[3]), payload, metadata));
const failed = results.filter(result => !result.passed);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' gating checks passed');
for (const failure of failed) console.log('FAIL  ' + failure.name + ': ' + failure.detail);
console.log('Owner cleanup: inspect these synthetic test object paths for any successful write:');
for (const objectPath of paths) console.log(objectPath);
process.exit(failed.length ? 1 : 0);
