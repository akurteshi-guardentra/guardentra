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
Use the approved Owner account for the environment-specific packet.

After a successful reauth:
  npx firebase-tools projects:list

Do not rely on the Firebase default project alias for release work.
Use an explicit --project from the current issue-bound staging/production packet.
Issue #126 tracks the legacy App Hosting main-branch connection; do not use this helper
to infer or change that connection.
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
