import { test as base, expect } from '@playwright/test';
import { resolveTarget, expectedSha } from './targets.mjs';

/** Collects page errors and console errors so a spec can assert there were none. */
export const test = base.extend({
  target: async ({}, use) => { await use(resolveTarget()); },
  sha: async ({}, use) => { await use(expectedSha()); },
  errors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await use(errors);
  },
});
export { expect };

// Browser noise that is not an app fault. Keep this list short and specific.
const IGNORED = [
  /favicon\.ico/i,
  /Content Security Policy.*report-only/i,
  /\[Report Only\]/i,
];
// A sandboxed local run has no route to Google Fonts or Firebase. Never ignored on staging or prod.
const LOCAL_ONLY = [/net::ERR_(TUNNEL_CONNECTION_FAILED|NAME_NOT_RESOLVED|PROXY_CONNECTION_FAILED|FAILED)/];
export function realErrors(errors) {
  const ignored = process.env.E2E_TARGET === 'local' ? [...IGNORED, ...LOCAL_ONLY] : IGNORED;
  return errors.filter((e) => !ignored.some((re) => re.test(e)));
}
