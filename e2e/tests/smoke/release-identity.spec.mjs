// Read-only. Every request here is a GET (or a CORS-only GET with an Origin header).
import { test, expect } from '../../lib/fixtures.mjs';

test('S1 /api/health names this environment and project', async ({ request, target }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('ok');
  expect(body.release?.environment).toBe(target.environment);
  if (target.projectId) expect(body.release?.projectId).toBe(target.projectId);
});

test('S2 the served sourceSha is the released commit', async ({ request, sha }) => {
  test.skip(!sha, 'E2E_EXPECT_SHA not set (unpinned run)');
  const body = await (await request.get('/api/health')).json();
  expect(body.release?.sourceSha).toBe(sha);
});

test('S3 unknown /api paths return JSON 404, not the SPA shell', async ({ request }) => {
  const res = await request.get('/api/__post_release_qa_probe__');
  expect(res.status()).toBe(404);
  expect(res.headers()['content-type'] || '').toContain('application/json');
});
