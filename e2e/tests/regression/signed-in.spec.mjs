/**
 * Signed-in, read-only regression on staging with one fixed synthetic admin.
 * Opens the main pages and checks they render with no permission or runtime errors.
 * It clicks no create, send, delete or save control.
 *
 * Needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (GitHub environment secrets). Without
 * them every test is skipped and the job summary says so; it never passes silently.
 * Values are only typed into the form. They are never printed, and traces are off.
 */
import { test, expect, realErrors } from '../../lib/fixtures.mjs';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe.configure({ mode: 'serial' });
if (process.env.E2E_TARGET !== 'staging' && process.env.E2E_TARGET !== 'local') {
  throw new Error('Signed-in regression is staging-only until the owner approves a prod account.');
}
test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured');

let shared;
test.beforeAll(async ({ browser }) => {
  shared = await browser.newContext();
  const page = await shared.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('Email Address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
  await page.close();
});
test.afterAll(async () => { await shared?.close(); });

const PAGES = [
  { id: 'R1', path: '/dashboard' },
  { id: 'R2', path: '/vendors' },
  { id: 'R3', path: '/assessments' },
  { id: 'R4', path: '/assessments/triage' },
  { id: 'R5', path: '/settings' },
];

for (const p of PAGES) {
  test(`${p.id} ${p.path} renders with no permission or runtime errors`, async () => {
    const page = await shared.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto(p.path);
    await expect(page).toHaveURL(new RegExp(p.path.replace(/\//g, '\\/')));
    // Signed-in pages keep Firestore listen/long-poll connections open, so
    // 'networkidle' never settles there. Wait for rendered content instead,
    // then give late permission errors a moment to surface.
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3_000);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/Missing or insufficient permissions/i);
    expect(text).not.toMatch(/Something went wrong/i);
    expect(realErrors(errors)).toEqual([]);
    await page.close();
  });
}
