/**
 * Cloud Run and App Hosting stay on 0.0.0.0.
 * The local demo launcher is the only path that binds loopback, and only for
 * the non-live project `demo-guardentra-local`.
 */
export function resolveListenHost(
  env: NodeJS.Dict<string | undefined> = process.env,
): string {
  const mode = String(env.APP_ENV || env.NODE_ENV || '').toLowerCase();
  if (mode === 'production' || mode === 'prod' || mode === 'staging') {
    return '0.0.0.0';
  }
  if (env.GUARDENTRA_LOCAL_DEMO === '1') {
    const project = String(env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || '').trim();
    if (project !== 'demo-guardentra-local') {
      throw new Error(
        'GUARDENTRA_LOCAL_DEMO is refused unless GCLOUD_PROJECT is demo-guardentra-local.',
      );
    }
    return '127.0.0.1';
  }
  return '0.0.0.0';
}
