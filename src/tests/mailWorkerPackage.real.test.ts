// @vitest-environment node
/**
 * Real packaged-worker install/load. This file is separate from the fixture
 * unit tests in mailWorkerPackage.test.ts. It must not be stubbed or skipped.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_REPO_ROOT,
  prepareMailWorkerPackage,
} from '../../scripts/prepare-mail-worker-package.mjs';

const scratch: string[] = [];

afterEach(() => {
  while (scratch.length) {
    const dir = scratch.pop();
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function gitHead(repoRoot: string) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'git rev-parse failed');
  return result.stdout.trim();
}

describe('real packaged mail worker', () => {
  it(
    'installs the locked package and loads disabled handlers with network blocked',
    () => {
      expect(process.version.startsWith('v22.')).toBe(true);
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-real-pkg-'));
      scratch.push(root);
      const outDir = path.join(root, 'upload', 'guardentra-mail');
      const receiptPath = path.join(root, 'receipts', 'receipt.json');
      const sourceSha = gitHead(DEFAULT_REPO_ROOT);

      const receipt = prepareMailWorkerPackage({
        repoRoot: DEFAULT_REPO_ROOT,
        sourceSha,
        target: 'staging',
        projectId: 'guardentra-staging',
        outDir,
        receipt: receiptPath,
        skipSmoke: true,
      });

      expect(receipt.sourceBinding).toBe('git-archive');
      expect(receipt.mailWorkerEnabled).toBe(false);
      expect(receipt.provenance?.sourceLockSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(receipt.provenance?.isolatedLockSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(receipt.provenance?.node).toBe(process.version);
      expect(receipt.inputIdentity?.before).toBe(receipt.inputIdentity?.after);

      const rootLock = JSON.parse(fs.readFileSync(path.join(DEFAULT_REPO_ROOT, 'package-lock.json'), 'utf8'));
      const isolated = JSON.parse(fs.readFileSync(path.join(outDir, 'package-lock.json'), 'utf8'));
      const isolatedKeys = Object.keys(isolated.packages).filter((key) => key !== '');
      expect(isolatedKeys.length).toBeGreaterThan(2);
      for (const key of isolatedKeys) {
        expect(isolated.packages[key].integrity).toBe(rootLock.packages[key].integrity);
        expect(isolated.packages[key].version).toBe(rootLock.packages[key].version);
        expect(isolated.packages[key].resolved).toBe(rootLock.packages[key].resolved);
      }
      expect(isolated.packages['node_modules/firebase-admin'].version).toBe(
        rootLock.packages['node_modules/firebase-admin'].version,
      );
      expect(isolated.packages['node_modules/jsonwebtoken']).toBeTruthy();

      const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-real-install-'));
      scratch.push(installDir);
      for (const file of ['index.cjs', 'package.json', 'package-lock.json']) {
        fs.copyFileSync(path.join(outDir, file), path.join(installDir, file));
      }
      const install = spawnSync('npm', ['ci', '--ignore-scripts'], {
        cwd: installDir,
        encoding: 'utf8',
        env: { ...process.env, npm_config_ignore_scripts: 'true' },
      });
      expect(install.status, install.stderr || install.stdout).toBe(0);

      const probe = path.join(installDir, 'load-disabled.cjs');
      fs.writeFileSync(
        probe,
        `'use strict';
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const calls = [];
function blocked(kind, target) {
  calls.push(kind + ' ' + String(target || ''));
  const error = new Error('BLOCKED_' + kind);
  error.code = 'BLOCKED_NETWORK';
  throw error;
}
for (const proto of [http, https]) {
  proto.request = function (options) {
    const host = typeof options === 'string' ? options : (options && (options.hostname || options.host || options.href));
    return blocked('request', host);
  };
  proto.get = proto.request;
}
net.Socket.prototype.connect = function (options) {
  const target = options && typeof options === 'object' ? (options.host || options.port) : options;
  return blocked('connect', target);
};
globalThis.fetch = function () { return blocked('fetch', ''); };
const mod = require('./index.cjs');
(async () => {
  await mod.handleMailCreated('synthetic-mail-id');
  await mod.handleMailRecovery();
  if (calls.length) {
    console.error(calls.join('\\n'));
    process.exit(2);
  }
  if (typeof mod.deliverMail === 'undefined' || typeof mod.recoverMail === 'undefined') process.exit(3);
  if (typeof mod.handleMailCreated !== 'function' || typeof mod.handleMailRecovery !== 'function') process.exit(4);
  console.log('REAL_PACKAGE_OK');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
`,
      );
      const env = {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        NODE_OPTIONS: '',
        MAIL_WORKER_ENABLED: 'false',
      };
      const loaded = spawnSync(process.execPath, [probe], {
        cwd: installDir,
        encoding: 'utf8',
        env,
      });
      expect(loaded.status, `${loaded.stdout}\n${loaded.stderr}`).toBe(0);
      expect(loaded.stdout).toContain('REAL_PACKAGE_OK');
    },
    180000,
  );
});
