/**
 * Loopback launcher for the October rehearsal.
 * Starts the existing application server (API + Vite middleware) against the
 * local Auth and Firestore emulators. Does not start emulators itself.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalDemoEnv, buildLocalDemoEnv } from './local-demo-preflight.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = buildLocalDemoEnv({
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  LANG: process.env.LANG,
});
env.NODE_OPTIONS = `--import ${path.join(root, 'scripts/local-demo-block-egress.mjs')}`;
assertLocalDemoEnv(env);

const healthUrl = `http://127.0.0.1:${env.PORT}/api/health`;
const child = spawn(path.join(root, 'node_modules/.bin/tsx'), ['server.ts'], {
  cwd: root,
  env,
  stdio: 'inherit',
});

async function waitForHealth() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`Server exited ${child.exitCode} before health`);
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        const body = await response.json();
        if (body.status === 'ok') {
          process.stdout.write(`local-demo health ok ${healthUrl}\n`);
          return;
        }
      }
    } catch {
      /* server still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for /api/health on loopback');
}

waitForHealth().catch((err) => {
  console.error(err);
  child.kill('SIGTERM');
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
