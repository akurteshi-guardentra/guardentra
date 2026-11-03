// Signed-out browser checks. Nothing is submitted, no account is used.
import { test, expect, realErrors } from '../../lib/fixtures.mjs';

test('S9 landing page renders without errors', async ({ page, errors }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('body')).not.toBeEmpty();
  await page.waitForLoadState('networkidle');
  expect(realErrors(errors)).toEqual([]);
});

test('S10 login page shows the sign-in form (no blank page)', async ({ page, errors }) => {
  await page.goto('/login');
  await expect(page.getByPlaceholder('Email Address')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  // The legacy blank /login fault threw "Incomplete Firebase client config".
  expect(errors.join('\n')).not.toMatch(/Incomplete Firebase client config/);
  expect(realErrors(errors)).toEqual([]);
});

test('S11 signed-out visit to a protected route lands on /login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('S12 a bogus portal link is refused', async ({ page, target }) => {
  test.skip(target.name === 'local', 'Needs a server with Firebase admin credentials');
  await page.goto('/portal/post-release-qa-bogus-0000');
  await expect(page.getByTestId('portal-link-unavailable')).toBeVisible();
});
