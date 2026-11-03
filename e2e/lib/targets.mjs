/**
 * The only hosts these suites may talk to. Anything else is refused before a
 * browser starts, so a typo in E2E_TARGET can never point a run at the wrong site.
 *
 * mutates: whether a suite that writes data may run against the target.
 * Production is read-only here. A write on prod needs a separate owner OK and a
 * code change to this table, reviewed in its own PR.
 */
export const TARGETS = {
  staging: {
    baseURL: 'https://guardentra--guardentra-staging.us-east4.hosted.app',
    environment: 'staging',
    projectId: 'guardentra-staging',
    mutates: true,
  },
  prod: {
    baseURL: 'https://guardentra.com',
    environment: 'production',
    projectId: 'guardentra-prod',
    mutates: false,
  },
  // A local `npm run build && npm start`, for checking the suites themselves.
  local: {
    baseURL: process.env.E2E_LOCAL_URL || 'http://127.0.0.1:3000',
    environment: process.env.E2E_LOCAL_ENV || 'production',
    projectId: process.env.E2E_LOCAL_PROJECT || null,
    mutates: false,
  },
};

export function resolveTarget(name = process.env.E2E_TARGET) {
  const key = String(name || '').trim();
  const target = TARGETS[key];
  if (!target) {
    throw new Error(`E2E_TARGET must be one of ${Object.keys(TARGETS).join(', ')}; got "${key}".`);
  }
  if (key === 'local') {
    const host = new URL(target.baseURL).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') {
      throw new Error('E2E_LOCAL_URL must be a loopback address.');
    }
  }
  return { name: key, ...target };
}

/** The full 40-char commit the target should be serving, or null when not pinned. */
export function expectedSha(value = process.env.E2E_EXPECT_SHA) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  if (!/^[0-9a-f]{40}$/.test(v)) throw new Error('E2E_EXPECT_SHA must be a full 40-char commit SHA.');
  return v;
}
