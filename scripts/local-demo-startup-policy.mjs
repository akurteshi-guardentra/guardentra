/**
 * Local-only startup policy for the demo launcher.
 * Not a filesystem sandbox and not a control on hosted production startup.
 * Hosted processes leave GUARDENTRA_LOCAL_DEMO unset and never enter this policy.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT = 'demo-guardentra-local';
const PLACEHOLDER = 'your_gemini_api_key_here';
const DIRECTORY_KEYS = {
  HOME: 'home',
  USERPROFILE: 'home',
  CLOUDSDK_CONFIG: 'cloudsdk',
  XDG_CONFIG_HOME: 'xdg',
  TMPDIR: 'tmp',
};
const FORBIDDEN = [
  'GOOGLE_APPLICATION_CREDENTIALS',
  'SENDGRID_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'AUDIT_DATABASE_URL',
  'API_KEY',
  'FIREBASE_CONFIG',
  'FIREBASE_WEBAPP_CONFIG',
  'K_SERVICE',
  'K_REVISION',
];

function refuse(reason) {
  const error = new Error(`LOCAL_STARTUP_REFUSED: ${reason}`);
  error.code = 'LOCAL_STARTUP_REFUSED';
  throw error;
}

export function createPrivateLocalState() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guardentra-local-state-'));
  fs.chmodSync(root, 0o700);
  for (const name of new Set(Object.values(DIRECTORY_KEYS))) {
    fs.mkdirSync(path.join(root, name), { mode: 0o700 });
  }
  return {
    GUARDENTRA_LOCAL_STATE_DIR: root,
    ...Object.fromEntries(
      Object.entries(DIRECTORY_KEYS).map(([key, name]) => [key, path.join(root, name)]),
    ),
  };
}

function verifyPrivateDirectory(dir) {
  let stat;
  try {
    stat = fs.lstatSync(dir);
  } catch {
    refuse('missing private state directory');
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) refuse('state directory must not be a link');
  if (process.platform !== 'linux') refuse('this candidate launcher is validated for Linux only');
  if (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) {
    refuse('state directory must be private and owned by this process user');
  }
}

/**
 * Returns false when this process is not the local demo.
 * Throws when the local demo flag is set but the process is not isolated.
 */
export function isIsolatedLocalStartup(env = process.env) {
  if (env.GUARDENTRA_LOCAL_DEMO !== '1') return false;
  const exact = {
    NODE_ENV: 'development',
    APP_ENV: 'development',
    GCLOUD_PROJECT: PROJECT,
    GOOGLE_CLOUD_PROJECT: PROJECT,
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
    FIREBASE_STORAGE_BUCKET: `${PROJECT}.appspot.com`,
    VITE_FIREBASE_PROJECT_ID: PROJECT,
    VITE_USE_LOCAL_EMULATORS: '1',
    AUDIT_SPINE_ENABLED: 'false',
    AUDIT_WORKER_ENABLED: 'false',
    MAIL_WORKER_ENABLED: 'false',
    ASSESSMENT_REMINDER_WORKER_ENABLED: 'false',
  };
  for (const [key, value] of Object.entries(exact)) {
    if (env[key] !== value) refuse(`invalid ${key}`);
  }
  for (const key of FORBIDDEN) {
    if (env[key] !== undefined && env[key] !== '') refuse(`forbidden ${key}`);
  }
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== PLACEHOLDER) refuse('live Gemini key');
  const root = env.GUARDENTRA_LOCAL_STATE_DIR;
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.resolve(root) !== root) {
    refuse('private state root is required');
  }
  verifyPrivateDirectory(root);
  for (const [key, name] of Object.entries(DIRECTORY_KEYS)) {
    if (env[key] !== path.join(root, name)) refuse(`invalid ${key} directory`);
    verifyPrivateDirectory(env[key]);
  }
  for (const candidate of [
    path.join(env.CLOUDSDK_CONFIG, 'application_default_credentials.json'),
    path.join(env.HOME, '.config', 'gcloud', 'application_default_credentials.json'),
    path.join(env.XDG_CONFIG_HOME, 'gcloud', 'application_default_credentials.json'),
  ]) {
    if (fs.existsSync(candidate)) refuse('credential file in local private state');
  }
  return true;
}
