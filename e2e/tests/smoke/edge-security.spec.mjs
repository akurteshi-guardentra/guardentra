// Read-only header, CORS and security.txt checks (#219).
import { test, expect } from '../../lib/fixtures.mjs';

test('S4 security headers are set and X-Powered-By is not', async ({ request }) => {
  const h = (await request.get('/')).headers();
  expect(h['strict-transport-security']).toMatch(/max-age=\d+/);
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBeTruthy();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-powered-by']).toBeUndefined();
});

test('S5 security.txt is plain text with a contact and canonical URL', async ({ request, target }) => {
  const res = await request.get('/.well-known/security.txt');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^text\/plain/);
  const text = await res.text();
  expect(text).toMatch(/^Contact: /m);
  expect(text).toMatch(/^Expires: /m);
  if (target.name !== 'local') {
    expect(text).toContain(`Canonical: ${new URL(target.baseURL).origin}/.well-known/security.txt`);
  }
});

test('S6 CORS does not echo a foreign origin', async ({ request }) => {
  const res = await request.get('/api/health', { headers: { Origin: 'https://evil.example' } });
  expect(res.headers()['access-control-allow-origin']).toBeUndefined();
});

test('S7 CORS echoes the app origin', async ({ request, target }) => {
  test.skip(target.name === 'local', 'PUBLIC_APP_URL is not set on a local build');
  const origin = new URL(target.baseURL).origin;
  const res = await request.get('/api/health', { headers: { Origin: origin } });
  expect(res.headers()['access-control-allow-origin']).toBe(origin);
});
