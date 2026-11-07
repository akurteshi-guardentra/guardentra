#!/usr/bin/env node
/**
 * Runs the Storage rules emulator suite (src/tests/storage.rules.test.mjs).
 *
 * Why this wrapper exists: storage.rules calls firestore.get()/exists(), which the
 * Storage emulator answers by calling the local Firestore emulator through
 * firebase-tools' own HTTP client (lib/apiv2.js). That client sends EVERY request
 * through HTTPS_PROXY / HTTP_PROXY when either is set, and it does not honour
 * NO_PROXY. On a machine behind a proxy (corporate network, sandboxed cloud dev
 * containers), the call to 127.0.0.1:8080 goes to the proxy, fails, and the
 * emulator silently treats it as "document not found". Every rule that needs a
 * Firestore lookup to ALLOW then denies, and the suite reports 4 false failures.
 *
 * The emulators only talk to localhost for a demo-* project, so the proxy variables
 * are dropped for this process tree only. Nothing outside the test run changes.
 * Cross-platform (Windows PowerShell, macOS, Linux), unlike `env -u` in package.json.
 */
import { spawn } from 'node:child_process';

const PROXY_VARS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'];

const env = { ...process.env };
const dropped = PROXY_VARS.filter((name) => name in env);
for (const name of PROXY_VARS) delete env[name];
if (dropped.length) {
  console.log(`[storage-rules] Ignoring ${dropped.join(', ')} for the local emulator run.`);
}

const child = spawn(
  'firebase emulators:exec --only firestore,storage --project demo-guardentra-storage-rules "node src/tests/storage.rules.test.mjs"',
  { env, stdio: 'inherit', shell: true },
);
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
