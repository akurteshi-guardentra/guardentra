#!/usr/bin/env node
/**
 * Firebase CLI reauth helper.
 *
 * Cursor/agent shells are non-interactive, so `firebase login --reauth` cannot
 * complete a browser OAuth flow here. This script prints the exact commands to
 * run in a local terminal (or Git Bash / PowerShell outside the agent).
 *
 * Usage: npm run firebase:reauth
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

console.log(`
Firebase CLI reauth
-------------------
Expected account: admin@guardentra.com
App Hosting project: guardentra-7f582 (backend: guardentra)

After a successful reauth:
  npx firebase-tools projects:list
  npx firebase-tools apphosting:rollouts:list --backend guardentra --project guardentra-7f582

Deploy check that does NOT need CLI (preferred after every main push):
  npm run verify:live
`);

if (!isInteractive) {
  console.log(`This environment is non-interactive (no browser OAuth).

Run in your own terminal:

  npx firebase-tools login --reauth

Or from the repo:

  npm run firebase:reauth
`);
  process.exit(0);
}

const result = spawnSync('npx', ['firebase-tools', 'login', '--reauth'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
