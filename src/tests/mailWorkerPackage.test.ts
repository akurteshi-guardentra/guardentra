// @vitest-environment node
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PrepareError,
  collectUnresolvedInputs,
  extractExternalImports,
  parseArgs,
  prepareMailWorkerPackage,
  resolveDependencyVersions,
  smokeCleanInstallAndLoad,
  assertTarget,
} from '../../scripts/prepare-mail-worker-package.mjs';

const nodeRequire = createRequire(import.meta.url);

const SOURCE_SHA = 'c7e5a04b2d20b8c04ed5afb5ba0fc811c2e63e05';

function tempDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-pkg-test-'));
  const outDir = path.join(root, 'upload', 'guardentra-mail');
  const receipt = path.join(root, 'receipts', 'mail-worker-package.receipt.json');
  return { root, outDir, receipt };
}

function writeMiniBundle(filePath: string, externals: string[] = ['firebase-admin/app', 'firebase-functions/v2/firestore']) {
  // Keep real require() forms for external extraction; swallow missing modules in unit tests.
  const requires = externals
    .map((spec) => `try { require(${JSON.stringify(spec)}); } catch (_err) { /* fixtures only */ }`)
    .join('\n');
  const source = `"use strict";
${requires}
exports.deliverMail = function deliverMail() { return 'deliver'; };
exports.recoverMail = function recoverMail() { return 'recover'; };
exports.handleMailCreated = async function handleMailCreated() { return; };
`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
  return source;
}

function baseOptions(dirs: { outDir: string; receipt: string }, overrides: Record<string, unknown> = {}) {
  const bundlePath = path.join(dirs.outDir, '..', 'fixture-bundle.cjs');
  writeMiniBundle(bundlePath);
  return {
    repoRoot: dirs.outDir, // unused when build/git mocked
    sourceSha: SOURCE_SHA,
    target: 'staging',
    projectId: 'guardentra-staging',
    outDir: dirs.outDir,
    receipt: dirs.receipt,
    skipSmoke: true,
    bundlePath,
    gitRevParse: () => SOURCE_SHA,
    lockfile: {
      packages: {
        'node_modules/firebase-admin': { version: '13.10.0' },
        'node_modules/firebase-functions': { version: '7.4.0' },
      },
    },
    runNpmInstall: (packageDir: string) => {
      // Deterministic lock without network.
      const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
      const lock = {
        name: pkg.name,
        lockfileVersion: 3,
        requires: true,
        packages: {
          '': { name: pkg.name, version: pkg.version, dependencies: pkg.dependencies },
          ...Object.fromEntries(
            Object.entries(pkg.dependencies || {}).map(([name, version]) => [
              `node_modules/${name}`,
              { version },
            ]),
          ),
        },
      };
      fs.writeFileSync(path.join(packageDir, 'package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
    },
    ...overrides,
  };
}

const scratch: string[] = [];

afterEach(() => {
  while (scratch.length) {
    const dir = scratch.pop();
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('mail worker package preparation', () => {
  it('parses CLI flags and refuses missing target via assertTarget', () => {
    const args = parseArgs([
      '--source-sha',
      SOURCE_SHA,
      '--target',
      'staging',
      '--project-id',
      'guardentra-staging',
      '--out-dir',
      'out',
      '--receipt',
      'receipt.json',
    ]);
    expect(args.target).toBe('staging');
    expect(() => assertTarget(undefined, 'guardentra-staging')).toThrowError(PrepareError);
    expect(() => assertTarget('production', 'guardentra-staging')).toThrowError(/WRONG_TARGET|Refuse target/);
    expect(() => assertTarget('staging', 'guardentra-prod')).toThrowError(/WRONG_PROJECT|Refuse project/);
  });

  it('records unresolved runtime inputs instead of inventing values', () => {
    const { unresolved, resolved } = collectUnresolvedInputs({}) as {
      unresolved: string[];
      resolved: Record<string, string | null>;
    };
    expect(unresolved).toEqual([
      'database',
      'region',
      'serviceAccount',
      'mailFrom',
      'providerRegion',
      'cutoverAt',
      'secretName',
    ]);
    expect(resolved.database).toBeNull();
    expect(resolved.region).toBeNull();
  });

  it('derives package dependency versions from the same-commit lockfile after reading bundle externals', () => {
    const source = writeMiniBundle(path.join(os.tmpdir(), `bundle-${Date.now()}.cjs`));
    const imports = extractExternalImports(source);
    expect(imports).toEqual(['firebase-admin/app', 'firebase-functions/v2/firestore']);
    const deps = resolveDependencyVersions(
      {
        packages: {
          'node_modules/firebase-admin': { version: '13.10.0' },
          'node_modules/firebase-functions': { version: '7.4.0' },
        },
      },
      imports,
    );
    expect(deps).toEqual({
      'firebase-admin': '13.10.0',
      'firebase-functions': '7.4.0',
    });
  });

  it('refuses missing out-dir / receipt and wrong target before staging files', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    try {
      prepareMailWorkerPackage(baseOptions(dirs, { outDir: undefined }));
      expect.fail('expected PrepareError');
    } catch (error) {
      expect(error).toBeInstanceOf(PrepareError);
      expect((error as InstanceType<typeof PrepareError>).code).toBe('MISSING_OUT_DIR');
    }
    try {
      prepareMailWorkerPackage(baseOptions(dirs, { target: 'production' }));
      expect.fail('expected PrepareError');
    } catch (error) {
      expect(error).toBeInstanceOf(PrepareError);
      expect((error as InstanceType<typeof PrepareError>).code).toBe('WRONG_TARGET');
    }
    expect(fs.existsSync(dirs.outDir)).toBe(false);
  });

  it('refuses a receipt path inside the upload context', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    try {
      prepareMailWorkerPackage(
        baseOptions(dirs, {
          receipt: path.join(dirs.outDir, 'inside-receipt.json'),
        }),
      );
      expect.fail('expected PrepareError');
    } catch (error) {
      expect(error).toBeInstanceOf(PrepareError);
      expect((error as InstanceType<typeof PrepareError>).code).toBe('RECEIPT_IN_PACKAGE');
    }
  });

  it('stages only worker bundle, manifests, and staging descriptor with MAIL_WORKER_ENABLED=false', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    // Provide a fake repo root firebase.json without functions.
    const repoRoot = path.join(dirs.root, 'repo');
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'firebase.json'), JSON.stringify({ firestore: {} }));
    const bundlePath = path.join(dirs.root, 'index-fixture.cjs');
    writeMiniBundle(bundlePath);

    const receipt = prepareMailWorkerPackage(
      baseOptions(dirs, {
        repoRoot,
        bundlePath,
      }),
    );

    expect(receipt.mailWorkerEnabled).toBe(false);
    expect(receipt.sourceSha).toBe(SOURCE_SHA);
    expect(receipt.dependencies).toEqual({
      'firebase-admin': '13.10.0',
      'firebase-functions': '7.4.0',
    });

    const staged = fs.readdirSync(dirs.outDir).sort();
    expect(staged).toEqual([
      'firebase.json',
      'index.cjs',
      'package-lock.json',
      'package.json',
      'staging.descriptor.json',
    ]);

    const pkg = JSON.parse(fs.readFileSync(path.join(dirs.outDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('guardentra-mail');
    expect(pkg.engines).toEqual({ node: '22' });
    expect(pkg.main).toBe('index.cjs');

    const descriptor = JSON.parse(
      fs.readFileSync(path.join(dirs.outDir, 'staging.descriptor.json'), 'utf8'),
    );
    expect(descriptor.target).toBe('staging');
    expect(descriptor.projectId).toBe('guardentra-staging');
    expect(descriptor.mailWorkerEnabled).toBe(false);
    expect(descriptor.params.MAIL_WORKER_ENABLED).toBe(false);
    expect(descriptor.exports).toEqual(['deliverMail', 'recoverMail']);
    expect(descriptor.unresolvedInputs.length).toBeGreaterThan(0);

    const mod = nodeRequire(path.join(dirs.outDir, 'index.cjs'));
    expect(mod.deliverMail).toBeTypeOf('function');
    expect(mod.recoverMail).toBeTypeOf('function');

    expect(fs.existsSync(dirs.receipt)).toBe(true);
    expect(receipt.hashes.bundle).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(createHash('sha256').update(fs.readFileSync(path.join(dirs.outDir, 'index.cjs'))).digest('hex')).toBe(
      receipt.hashes.bundle.slice('sha256:'.length),
    );

    // Root firebase remains unwired.
    expect(JSON.parse(fs.readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8')).functions).toBeUndefined();
  });

  it('disabled packaged handlers do not call a provider during smoke load', async () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    const providerSend = vi.fn();
    const bundlePath = path.join(dirs.root, 'disabled-bundle.cjs');
    fs.writeFileSync(
      bundlePath,
      `"use strict";
try { require("firebase-admin/app"); } catch (_err) {}
try { require("firebase-functions/v2/firestore"); } catch (_err) {}
const providerSend = globalThis.__mailProviderSend;
exports.deliverMail = { __brand: 'deliverMail' };
exports.recoverMail = { __brand: 'recoverMail' };
exports.handleMailCreated = async function handleMailCreated() {
  // Mirrors MAIL_WORKER_ENABLED=false short-circuit: no provider call.
  const enabled = false;
  if (!enabled) return;
  providerSend();
};
`,
    );

    (globalThis as { __mailProviderSend?: unknown }).__mailProviderSend = providerSend;
    const repoRoot = path.join(dirs.root, 'repo');
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'firebase.json'), JSON.stringify({ firestore: {} }));

    prepareMailWorkerPackage(
      baseOptions(dirs, {
        bundlePath,
        repoRoot,
      }),
    );

    const mod = nodeRequire(path.join(dirs.outDir, 'index.cjs'));
    await mod.handleMailCreated('mail-id');
    expect(providerSend).not.toHaveBeenCalled();
    expect(mod.deliverMail).toBeTruthy();
    expect(mod.recoverMail).toBeTruthy();
  });

  it('clean-install/load smoke proves entrypoint exports without contacting providers', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    const smokeRoot = path.join(dirs.root, 'smoke-src');
    fs.mkdirSync(smokeRoot, { recursive: true });
    writeMiniBundle(path.join(smokeRoot, 'index.cjs'), []);
    fs.writeFileSync(
      path.join(smokeRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'guardentra-mail',
          private: true,
          main: 'index.cjs',
          engines: { node: '22' },
          dependencies: {},
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(smokeRoot, 'package-lock.json'),
      JSON.stringify(
        {
          name: 'guardentra-mail',
          lockfileVersion: 3,
          requires: true,
          packages: { '': { name: 'guardentra-mail', version: '0.0.0' } },
        },
        null,
        2,
      ),
    );

    const result = smokeCleanInstallAndLoad(smokeRoot, {
      runNpmCi: () => {
        // No network - package has zero dependencies.
      },
    });
    expect(result.exports).toEqual(['deliverMail', 'recoverMail']);
  });
});
