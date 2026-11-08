/**
 * #72 staging mail acceptance. Owner-requested, manual run only (workflow_dispatch suite=mail).
 * Signs in as the synthetic staging admin, uses "Invite" on /vendors to add ONE test vendor
 * whose contact is E2E_MAIL_TO (an owner-controlled address), and checks the app reports the
 * welcome email as queued. Delivery to the inbox is checked separately (Gmail + mail doc).
 *
 * This WRITES on staging: one vendor, one vendor_invites record, one mail doc, one audit event.
 * Never runs on push, never on prod. No retries, so one run sends at most one email.
 */
import { test, expect } from '../../lib/fixtures.mjs';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const mailTo = process.env.E2E_MAIL_TO;

if (process.env.E2E_TARGET !== 'staging') {
  throw new Error('Mail acceptance is staging-only.');
}
test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured');
test.skip(!mailTo, 'E2E_MAIL_TO not set');
// Only owner-controlled company mailboxes may receive test mail.
if (mailTo && !/^[^\s@<>]+@guardentra\.com$/i.test(mailTo.trim())) {
  throw new Error('E2E_MAIL_TO must be an @guardentra.com address.');
}

test('M1 Invite vendor queues one welcome email', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email Address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });

  await page.goto('/vendors');
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  const form = page.locator('form').filter({ hasText: 'Invite Vendor' });
  await expect(form).toBeVisible();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  await form.locator('input[name="name"]').fill(`E2E Mail Test ${stamp}`);
  await form.locator('input[name="primaryContactName"]').fill('E2E Mail Test');
  await form.locator('input[name="primaryContactEmail"]').fill(mailTo);

  const notify = page.waitForResponse((r) => r.url().includes('/api/notify/mail') && r.request().method() === 'POST', { timeout: 45_000 });
  await form.getByRole('button', { name: 'Add & Invite' }).click();
  const res = await notify;
  const body = await res.json().catch(() => ({}));
  console.log(`notify status=${res.status()} queued=${body.queued} deduplicated=${body.deduplicated} id=${body.id || ''}`);
  expect(res.status()).toBe(200);
  expect(body.queued).toBe(true);
  await expect(page.getByText('Welcome email queued', { exact: false })).toBeVisible({ timeout: 15_000 });
  console.log(`vendor stamp ${stamp}`);
});
