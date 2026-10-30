// @vitest-environment node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PrepareError,
  assertClosureBoundToSource,
  assertTarget,
  buildIsolatedLockfile,
  collectUnresolvedInputs,
  extractExternalImports,
  parseArgs,
  prepareMailWorkerPackage,
  resolveDependencyVersions,
  smokeCleanInstallAndLoad,
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

function baseOptions(dirs: { root: string; outDir: string; receipt: string }, overrides: Record<string, unknown> = {}) {
  const bundlePath = path.join(dirs.root, 'fixture-bundle.cjs');
  writeMiniBundle(bundlePath);
  const repoRoot = path.join(dirs.root, 'repo');
  fs.mkdirSync(repoRoot, { recursive: true });
  if (!fs.existsSync(path.join(repoRoot, 'firebase.json'))) {
    fs.writeFileSync(path.join(repoRoot, 'firebase.json'), JSON.stringify({ firestore: {} }));
  }
  return {
    repoRoot,
    sourceSha: SOURCE_SHA,
    target: 'staging',
    projectId: 'guardentra-staging',
    outDir: dirs.outDir,
    receipt: dirs.receipt,
    skipSmoke: true,
    fixtureMode: true,
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
    expect(descriptor.exports).toEqual([
      'deliverMail',
      'recoverMail',
      'handleMailCreated',
      'handleMailRecovery',
    ]);
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

function git(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

function sourceLockFixture() {
  return {
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { dependencies: { 'firebase-admin': '1.2.3' } },
      'node_modules/firebase-admin': {
        version: '1.2.3',
        resolved: 'https://example.invalid/firebase-admin-1.2.3.tgz',
        integrity: 'sha512-clean',
        dependencies: { 'transitive-lib': '4.5.6' },
        optionalDependencies: { 'optional-lib': '1.0.0' },
      },
      'node_modules/transitive-lib': {
        version: '4.5.6',
        resolved: 'https://example.invalid/transitive-lib-4.5.6.tgz',
        integrity: 'sha512-transitive',
      },
      'node_modules/optional-lib': {
        version: '1.0.0',
        resolved: 'https://example.invalid/optional-lib-1.0.0.tgz',
        integrity: 'sha512-optional',
      },
      'node_modules/unrelated': {
        version: '9.9.9',
        resolved: 'https://example.invalid/unrelated-9.9.9.tgz',
        integrity: 'sha512-unrelated',
      },
    },
  };
}

const FIXTURE_BUILD = `import fs from 'node:fs';
const src = fs.readFileSync('server/mailWorkerFunctions.ts', 'utf8');
fs.mkdirSync('dist/mail-worker', { recursive: true });
const body = [
  'exports.deliverMail=function(){};',
  'exports.recoverMail=function(){};',
  'require("firebase-admin/app");',
  '// ' + src,
].join('\\n');
fs.writeFileSync('dist/mail-worker/index.cjs', body);
`;

function initSourceRepo(dir: string) {
  fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'server', 'mailWorkerFunctions.ts'), 'export const marker = "CLEAN_WORKER";\n');
  fs.writeFileSync(path.join(dir, 'firebase.json'), '{}\n');
  fs.writeFileSync(path.join(dir, 'build-fixture.mjs'), FIXTURE_BUILD);
  fs.writeFileSync(path.join(dir, 'package-lock.json'), `${JSON.stringify(sourceLockFixture(), null, 2)}\n`);
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fixture-mail-source',
        private: true,
        scripts: { 'build:mail-worker': 'node build-fixture.mjs' },
      },
      null,
      2,
    )}\n`,
  );
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'mail-package-test@example.com']);
  git(dir, ['config', 'user.name', 'Mail Package Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-m', 'fixture source']);
  return git(dir, ['rev-parse', 'HEAD']);
}

describe('mail worker package path safety', () => {
  it('refuses a populated output directory and leaves the sentinel untouched', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    fs.mkdirSync(dirs.outDir, { recursive: true });
    const sentinel = path.join(dirs.outDir, 'sentinel.txt');
    fs.writeFileSync(sentinel, 'keep');
    expect(() => prepareMailWorkerPackage(baseOptions(dirs))).toThrowError(/OUTPUT_EXISTS/);
    expect(fs.readFileSync(sentinel, 'utf8')).toBe('keep');
  });

  it('refuses checkout overlap and an ancestor of the checkout', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    const repo = path.join(dirs.root, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    const sentinel = path.join(repo, 'sentinel.txt');
    fs.writeFileSync(sentinel, 'keep');
    fs.writeFileSync(path.join(repo, 'firebase.json'), '{}\n');
    expect(() =>
      prepareMailWorkerPackage(baseOptions(dirs, { repoRoot: repo, outDir: path.join(repo, 'pkg') })),
    ).toThrowError(/PATH_OVERLAP/);
    expect(() =>
      prepareMailWorkerPackage(baseOptions(dirs, { repoRoot: repo, outDir: dirs.root })),
    ).toThrowError(/PATH_OVERLAP|OUTPUT_EXISTS/);
    expect(fs.readFileSync(sentinel, 'utf8')).toBe('keep');
  });

  it('refuses a symlinked output path and a symlinked ancestor without following them', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    const target = path.join(dirs.root, 'real-target');
    fs.mkdirSync(target, { recursive: true });
    const sentinel = path.join(target, 'sentinel.txt');
    fs.writeFileSync(sentinel, 'keep');
    const link = path.join(dirs.root, 'linked-out');
    fs.symlinkSync(target, link);
    expect(() => prepareMailWorkerPackage(baseOptions(dirs, { outDir: link }))).toThrowError(/LINKED_PATH/);

    const outside = path.join(dirs.root, 'outside');
    fs.mkdirSync(outside, { recursive: true });
    const outsideSentinel = path.join(outside, 'sentinel.txt');
    fs.writeFileSync(outsideSentinel, 'keep');
    const parentLink = path.join(dirs.root, 'parent-link');
    fs.symlinkSync(outside, parentLink);
    expect(() =>
      prepareMailWorkerPackage(baseOptions(dirs, { outDir: path.join(parentLink, 'new-package') })),
    ).toThrowError(/LINKED_PATH/);
    expect(fs.readFileSync(sentinel, 'utf8')).toBe('keep');
    expect(fs.readFileSync(outsideSentinel, 'utf8')).toBe('keep');
  });

  it('refuses an existing receipt and leaves its bytes untouched', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    fs.mkdirSync(path.dirname(dirs.receipt), { recursive: true });
    fs.writeFileSync(dirs.receipt, 'keep-receipt');
    expect(() => prepareMailWorkerPackage(baseOptions(dirs))).toThrowError(/RECEIPT_EXISTS/);
    expect(fs.readFileSync(dirs.receipt, 'utf8')).toBe('keep-receipt');
  });
});

describe('mail worker exact source binding', () => {
  it('packages the committed worker, lockfile, and build script when the worktree is dirty', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    const repo = path.join(dirs.root, 'src-repo');
    fs.mkdirSync(repo, { recursive: true });
    const sha = initSourceRepo(repo);
    fs.writeFileSync(path.join(repo, 'server', 'mailWorkerFunctions.ts'), 'export const marker = "DIRTY_WORKER";\n');
    const lock = sourceLockFixture() as { packages: Record<string, { version?: string; integrity?: string }> };
    lock.packages['node_modules/firebase-admin'].version = '9.9.9';
    lock.packages['node_modules/firebase-admin'].integrity = 'sha512-dirty';
    fs.writeFileSync(path.join(repo, 'package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
    const pkgPath = path.join(repo, 'package.json');
    const dirtyPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    dirtyPkg.scripts['build:mail-worker'] = 'node -e "process.stdout.write(\'DIRTY_SCRIPT\')"';
    fs.writeFileSync(pkgPath, `${JSON.stringify(dirtyPkg, null, 2)}\n`);

    const receipt = prepareMailWorkerPackage({
      repoRoot: repo,
      sourceSha: sha,
      target: 'staging',
      projectId: 'guardentra-staging',
      outDir: dirs.outDir,
      receipt: dirs.receipt,
      skipSmoke: true,
      runNpmInstall: () => {
        throw new Error('npm install must not generate the isolated lock');
      },
    });

    const bundle = fs.readFileSync(path.join(dirs.outDir, 'index.cjs'), 'utf8');
    expect(bundle).toContain('CLEAN_WORKER');
    expect(bundle).not.toContain('DIRTY_WORKER');
    expect((receipt.dependencies as Record<string, string>)['firebase-admin']).toBe('1.2.3');
    const isolated = JSON.parse(fs.readFileSync(path.join(dirs.outDir, 'package-lock.json'), 'utf8'));
    expect(isolated.packages['node_modules/transitive-lib'].integrity).toBe('sha512-transitive');
    expect(isolated.packages['node_modules/firebase-admin'].integrity).toBe('sha512-clean');
    expect(fs.readFileSync(path.join(repo, 'server', 'mailWorkerFunctions.ts'), 'utf8')).toContain('DIRTY_WORKER');
    expect(fs.readFileSync(pkgPath, 'utf8')).toContain('DIRTY_SCRIPT');
    expect(receipt.sourceBinding).toBe('git-archive');
    const identity = receipt.inputIdentity as { before: string; after: string };
    expect(identity.before).toBe(identity.after);
  });

  it('refuses when packaged inputs change during the build and leaves the worktree dirty', () => {
    const dirs = tempDirs();
    scratch.push(dirs.root);
    const repo = path.join(dirs.root, 'src-repo');
    fs.mkdirSync(repo, { recursive: true });
    const sha = initSourceRepo(repo);
    fs.writeFileSync(path.join(repo, 'server', 'mailWorkerFunctions.ts'), 'export const marker = "STILL_DIRTY";\n');
    expect(() =>
      prepareMailWorkerPackage({
        repoRoot: repo,
        sourceSha: sha,
        target: 'staging',
        projectId: 'guardentra-staging',
        outDir: dirs.outDir,
        receipt: dirs.receipt,
        skipSmoke: true,
        testHooks: true,
        runNpmBuild: (buildRoot: string) => {
          fs.appendFileSync(path.join(buildRoot, 'package-lock.json'), '\n');
          fs.mkdirSync(path.join(buildRoot, 'dist', 'mail-worker'), { recursive: true });
          fs.writeFileSync(
            path.join(buildRoot, 'dist', 'mail-worker', 'index.cjs'),
            'exports.deliverMail=function(){};exports.recoverMail=function(){};require("firebase-admin/app");\n',
          );
        },
      }),
    ).toThrowError(/SOURCE_CHANGED/);
    expect(fs.existsSync(dirs.outDir)).toBe(false);
    expect(fs.readFileSync(path.join(repo, 'server', 'mailWorkerFunctions.ts'), 'utf8')).toContain('STILL_DIRTY');
  });
});

describe('mail worker locked dependency closure', () => {
  it('copies transitive integrity from the source lock and rejects drift', () => {
    const source = sourceLockFixture();
    const isolated = buildIsolatedLockfile(source, { 'firebase-admin': '1.2.3' }) as {
      packages: Record<string, { integrity?: string }>;
    };
    expect(isolated.packages['node_modules/transitive-lib'].integrity).toBe('sha512-transitive');
    expect(isolated.packages['node_modules/optional-lib'].integrity).toBe('sha512-optional');
    expect(isolated.packages['node_modules/unrelated']).toBeUndefined();
    isolated.packages['node_modules/transitive-lib'].integrity = 'sha512-drift';
    expect(() => assertClosureBoundToSource(isolated, source)).toThrowError(/LOCK_DRIFT/);
  });

  it('fails closed when a required transitive package is absent', () => {
    const source = sourceLockFixture();
    delete (source.packages as Record<string, unknown>)['node_modules/transitive-lib'];
    expect(() => buildIsolatedLockfile(source, { 'firebase-admin': '1.2.3' })).toThrowError(/LOCKFILE_MISS/);
  });
});
