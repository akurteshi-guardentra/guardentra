// Read-only. Crawls every JS chunk reachable from "/" and checks the inlined
// VITE_FIREBASE_* values. See lib/bundle.mjs for why raw string matches are wrong.
import { test, expect } from '../../lib/fixtures.mjs';
import { crawlBundle, isolationVerdict } from '../../lib/bundle.mjs';

test('S8 the client bundle is built for this Firebase project only', async ({ request, target }) => {
  test.skip(!target.projectId, 'No expected project for this target');
  test.setTimeout(180_000);
  const { chunks, env, failed } = await crawlBundle(request, target.baseURL);
  expect(failed, 'every referenced chunk loads').toEqual([]);
  expect(chunks).toBeGreaterThan(1);
  const verdict = isolationVerdict(env, target.projectId);
  // Print names and project ids only. The API key is never printed.
  console.log(`bundle: ${chunks} chunks; VITE_FIREBASE_PROJECT_ID=${[...(env.VITE_FIREBASE_PROJECT_ID || [])].join(',')}`);
  expect(verdict.problems).toEqual([]);
});
