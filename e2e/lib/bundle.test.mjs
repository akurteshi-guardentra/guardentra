import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFirebaseEnv, isolationVerdict, chunkRefs } from './bundle.mjs';

const prodBuild =
  'const e={BASE_URL:"/",VITE_FIREBASE_PROJECT_ID:`guardentra-prod\\r\\n`,' +
  'VITE_FIREBASE_AUTH_DOMAIN:`guardentra-prod.firebaseapp.com\\r\\n`,VITE_FIREBASE_API_KEY:`AIzaFAKE`};' +
  'const HOSTED=["guardentra-staging","guardentra-prod"];const DEMO="guardentra-7f582";';

test('backtick template literals with trailing \\r\\n count as a pass', () => {
  const env = extractFirebaseEnv(prodBuild);
  assert.deepEqual([...env.VITE_FIREBASE_PROJECT_ID], ['guardentra-prod']);
  assert.deepEqual(isolationVerdict(env, 'guardentra-prod'), { pass: true, problems: [] });
});

test('double and single quotes are read too', () => {
  const env = extractFirebaseEnv('{"VITE_FIREBASE_PROJECT_ID":"guardentra-staging",VITE_FIREBASE_STORAGE_BUCKET:\'guardentra-staging.firebasestorage.app\'}');
  assert.equal(isolationVerdict(env, 'guardentra-staging').pass, true);
});

test('allowlist and demo constants alone do not fail the check', () => {
  const env = extractFirebaseEnv(prodBuild);
  assert.equal(isolationVerdict(env, 'guardentra-prod').pass, true);
});

test('a staging value inlined into a prod build fails', () => {
  const env = extractFirebaseEnv(prodBuild + 'x={VITE_FIREBASE_STORAGE_BUCKET:"guardentra-staging.firebasestorage.app"}');
  const v = isolationVerdict(env, 'guardentra-prod');
  assert.equal(v.pass, false);
  assert.match(v.problems.join(), /STORAGE_BUCKET names guardentra-staging/);
});

test('two different project ids fail', () => {
  const env = extractFirebaseEnv('a={VITE_FIREBASE_PROJECT_ID:"guardentra-prod"};b={VITE_FIREBASE_PROJECT_ID:"guardentra-7f582"}');
  assert.equal(isolationVerdict(env, 'guardentra-prod').pass, false);
});

test('a missing project id fails rather than passing silently', () => {
  assert.equal(isolationVerdict({}, 'guardentra-prod').pass, false);
});

test('chunk refs cover absolute, relative and dynamic imports', () => {
  const refs = chunkRefs('import"./a-1.js";import("./b-2.js");"/assets/c-3.js";"assets/d-4.js"');
  assert.deepEqual([...refs].sort(), ['/assets/a-1.js', '/assets/b-2.js', '/assets/c-3.js', '/assets/d-4.js']);
});
