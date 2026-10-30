/**
 * Environment for the loopback October rehearsal.
 * Built from an allowlist so a parent shell's ADC, .env secrets, and cloud
 * project ids are not inherited.
 */

export const LOCAL_DEMO_PROJECT_ID = 'demo-guardentra-local';

const PLACEHOLDER_GEMINI_KEY = 'your_gemini_api_key_here';

export function buildLocalDemoEnv(base = {}) {
  return {
    PATH: base.PATH || '/usr/bin:/bin',
    HOME: base.HOME || '/tmp',
    TMPDIR: base.TMPDIR || '/tmp',
    LANG: base.LANG || 'C.UTF-8',
    NODE_ENV: 'development',
    APP_ENV: 'development',
    GUARDENTRA_LOCAL_DEMO: '1',
    GCLOUD_PROJECT: LOCAL_DEMO_PROJECT_ID,
    GOOGLE_CLOUD_PROJECT: LOCAL_DEMO_PROJECT_ID,
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
    FIREBASE_STORAGE_BUCKET: 'demo-guardentra-local.appspot.com',
    PORT: '5173',
    GEMINI_API_KEY: PLACEHOLDER_GEMINI_KEY,
    AUDIT_SPINE_ENABLED: 'false',
    AUDIT_WORKER_ENABLED: 'false',
    ASSESSMENT_REMINDER_WORKER_ENABLED: 'false',
    MAIL_WORKER_ENABLED: 'false',
    VITE_USE_LOCAL_EMULATORS: '1',
    VITE_FIREBASE_API_KEY: 'AIzaSyDummyVitestFirebaseKey000',
    VITE_FIREBASE_PROJECT_ID: LOCAL_DEMO_PROJECT_ID,
    VITE_FIREBASE_AUTH_DOMAIN: 'demo-guardentra-local.firebaseapp.com',
    VITE_FIREBASE_STORAGE_BUCKET: 'demo-guardentra-local.appspot.com',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789012',
    VITE_FIREBASE_APP_ID: '1:123456789012:web:abcdef0123456789abcdef',
  };
}

export function assertLocalDemoEnv(env) {
  const errors = [];
  if (env.GUARDENTRA_LOCAL_DEMO !== '1') errors.push('GUARDENTRA_LOCAL_DEMO must be 1');
  if (env.GCLOUD_PROJECT !== LOCAL_DEMO_PROJECT_ID) errors.push('project must be demo-guardentra-local');
  if (env.GOOGLE_CLOUD_PROJECT !== LOCAL_DEMO_PROJECT_ID) errors.push('GOOGLE_CLOUD_PROJECT mismatch');
  if (env.GOOGLE_APPLICATION_CREDENTIALS) errors.push('service account key is refused');
  if (env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') errors.push('auth emulator must be loopback :9099');
  if (env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') errors.push('firestore emulator must be loopback :8080');
  if (env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') errors.push('storage emulator must be loopback :9199');
  if (env.PORT === '8080' || env.PORT === '3000' || env.PORT === '5000') {
    errors.push('application port collides with a reserved port');
  }
  if (env.APP_ENV === 'production' || env.APP_ENV === 'staging') errors.push('hosted APP_ENV is refused');
  if (env.AUDIT_SPINE_ENABLED === 'true' || env.AUDIT_SPINE_ENABLED === '1') {
    errors.push('audit spine stays off for this rehearsal');
  }
  if (env.MAIL_WORKER_ENABLED === 'true' || env.MAIL_WORKER_ENABLED === '1') {
    errors.push('mail worker stays off');
  }
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== PLACEHOLDER_GEMINI_KEY) {
    errors.push('a live Gemini key is refused');
  }
  for (const key of ['SENDGRID_API_KEY', 'STRIPE_SECRET_KEY', 'AUDIT_DATABASE_URL']) {
    if (env[key]) errors.push(`${key} must not be set`);
  }
  if (errors.length) {
    throw new Error(errors.join('; '));
  }
}
