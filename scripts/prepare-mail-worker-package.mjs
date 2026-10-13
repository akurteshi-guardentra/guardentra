/**
 * Prepare an isolated Firebase Functions codebase (`guardentra-mail`) for the
 * self-managed mail worker. Source preparation only - does not deploy, enable
 * email, bind secrets, or contact providers/GCP.
 *
 * Usage:
 *   node scripts/prepare-mail-worker-package.mjs \
 *     --source-sha <40-char-sha> \
 *     --target staging \
 *     --project-id guardentra-staging \
 *     --out-dir <upload-context-dir> \
 *     --receipt <path-outside-out-dir>
 *
 * Optional explicit runtime inputs (never invented when omitted):
 *   --database --region --service-account --mail-from
 *   --provider-region us|eu --cutover-at <UTC ISO ending Z>
 *   --secret-name SENDGRID_API_KEY
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
export const CODEBASE_NAME = 'guardentra-mail';
export const BUNDLE_REL = path.join('dist', 'mail-worker', 'index.cjs');
export const ALLOWED_TARGET = 'staging';
export const STAGING_PROJECT_ID = 'guardentra-staging';
export const FORBIDDEN_PROJECT_FRAGMENTS = ['prod', 'production', 'demo', '7f582'];

const RUNTIME_INPUT_KEYS = [
  'database',
  'region',
  'serviceAccount',
  'mailFrom',
  'providerRegion',
  'cutoverAt',
  'secretName',
];

const EXCLUDED_NAME_RE =
  /(^|[/\\])(\.env|\.env\..*|\.git|terraform|\.tfstate|\.tfplan|.*\.(pem|p12|key)|serviceAccount.*\.json|.*token.*|node_modules)([/\\]|$)/i;

export class PrepareError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PrepareError';
    this.code = code;
  }
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new PrepareError('USAGE', `Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return {
    sourceSha: out['source-sha'],
    target: out.target,
    projectId: out['project-id'],
    outDir: out['out-dir'],
    receipt: out.receipt,
    database: out.database,
    region: out.region,
    serviceAccount: out['service-account'],
    mailFrom: out['mail-from'],
    providerRegion: out['provider-region'],
    cutoverAt: out['cutover-at'],
    secretName: out['secret-name'],
    skipSmoke: Boolean(out['skip-smoke']),
    repoRoot: out['repo-root'],
  };
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return `sha256:${hash.digest('hex')}`;
}

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

export function assertSourceSha(repoRoot, sourceSha, gitRevParse = defaultGitRevParse) {
  if (!sourceSha || !/^[0-9a-f]{40}$/i.test(sourceSha)) {
    throw new PrepareError('MISSING_SOURCE_SHA', 'Require explicit 40-char Git source SHA');
  }
  const head = gitRevParse(repoRoot);
  if (head.toLowerCase() !== sourceSha.toLowerCase()) {
    throw new PrepareError(
      'SOURCE_SHA_MISMATCH',
      `Checkout HEAD ${head} does not match --source-sha ${sourceSha}`,
    );
  }
  return head.toLowerCase();
}

function defaultGitRevParse(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new PrepareError('GIT_ERROR', result.stderr || 'git rev-parse HEAD failed');
  }
  return result.stdout.trim();
}

export function assertTarget(target, projectId) {
  if (!target) {
    throw new PrepareError('MISSING_TARGET', 'Require --target staging');
  }
  if (target !== ALLOWED_TARGET) {
    throw new PrepareError(
      'WRONG_TARGET',
      `Refuse target "${target}"; only "${ALLOWED_TARGET}" is permitted for package preparation`,
    );
  }
  if (!projectId) {
    throw new PrepareError('MISSING_PROJECT_ID', 'Require --project-id for staging package');
  }
  const normalized = String(projectId).toLowerCase();
  if (normalized !== STAGING_PROJECT_ID) {
    throw new PrepareError(
      'WRONG_PROJECT',
      `Refuse project "${projectId}"; staging package requires ${STAGING_PROJECT_ID}`,
    );
  }
  for (const fragment of FORBIDDEN_PROJECT_FRAGMENTS) {
    if (fragment === 'staging') continue;
    if (normalized.includes(fragment) && normalized !== STAGING_PROJECT_ID) {
      throw new PrepareError('WRONG_PROJECT', `Refuse non-staging project fragment: ${fragment}`);
    }
  }
}

/**
 * @param {Record<string, unknown>} [inputs]
 * @returns {{ unresolved: string[], resolved: Record<string, string | null> }}
 */
export function collectUnresolvedInputs(inputs = {}) {
  const unresolved = [];
  /** @type {Record<string, string | null>} */
  const resolved = {};

  for (const key of RUNTIME_INPUT_KEYS) {
    const value = inputs[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      unresolved.push(key);
      resolved[key] = null;
      continue;
    }
    const text = String(value).trim();
    if (key === 'providerRegion' && !['us', 'eu'].includes(text)) {
      throw new PrepareError('INVALID_PROVIDER_REGION', 'providerRegion must be us or eu');
    }
    if (key === 'cutoverAt' && (!Number.isFinite(Date.parse(text)) || !/Z$/.test(text))) {
      throw new PrepareError('INVALID_CUTOVER', 'cutoverAt must be UTC ISO ending in Z');
    }
    if (key === 'mailFrom' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(text)) {
      throw new PrepareError('INVALID_MAIL_FROM', 'mailFrom must be a verified sender address shape');
    }
    resolved[key] = text;
  }
  return { unresolved, resolved };
}

/** Extract external package require/import specifiers from an esbuild CJS bundle. */
export function extractExternalImports(bundleSource) {
  const found = new Set();
  const requireRe = /require\((['"])([^'"]+)\1\)/g;
  let match;
  while ((match = requireRe.exec(bundleSource)) !== null) {
    const spec = match[2];
    if (spec.startsWith('.') || spec.startsWith('/') || path.isAbsolute(spec)) continue;
    if (NODE_BUILTINS.has(spec) || spec.startsWith('node:')) continue;
    found.add(spec);
  }
  return [...found].sort();
}

export function rootPackageName(specifier) {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0];
}

export function resolveDependencyVersions(lockfile, externalImports) {
  const packages = lockfile.packages || {};
  const deps = {};
  for (const spec of externalImports) {
    const name = rootPackageName(spec);
    const entry = packages[`node_modules/${name}`];
    if (!entry?.version) {
      throw new PrepareError(
        'LOCKFILE_MISS',
        `Bundle external "${spec}" (package ${name}) missing from repository lockfile`,
      );
    }
    deps[name] = entry.version;
  }
  return deps;
}

function assertNoExcludedPaths(dir) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const rel = path.relative(dir, full).replace(/\\/g, '/');
      if (EXCLUDED_NAME_RE.test(rel) || EXCLUDED_NAME_RE.test(entry.name)) {
        throw new PrepareError('EXCLUDED_ARTIFACT', `Forbidden path staged in package: ${rel}`);
      }
      if (entry.isDirectory()) stack.push(full);
    }
  }
}

function runCommand(command, args, cwd, label) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  });
  if (result.status !== 0) {
    throw new PrepareError(
      'COMMAND_FAILED',
      `${label} failed: ${result.stderr || result.stdout || `exit ${result.status}`}`,
    );
  }
  return result;
}

export function buildMailWorkerBundle(repoRoot, { runNpmBuild } = {}) {
  if (typeof runNpmBuild === 'function') {
    runNpmBuild(repoRoot);
  } else {
    runCommand('npm', ['run', 'build:mail-worker'], repoRoot, 'npm run build:mail-worker');
  }
  const bundlePath = path.join(repoRoot, BUNDLE_REL);
  if (!fs.existsSync(bundlePath)) {
    throw new PrepareError('BUNDLE_MISSING', `Expected bundle at ${BUNDLE_REL}`);
  }
  return bundlePath;
}

function writePackageManifest({ name, engines, dependencies, main }) {
  return `${JSON.stringify(
    {
      name,
      private: true,
      version: '0.0.0',
      description: 'Isolated GuardEntra mail worker Functions codebase (source preparation only)',
      type: 'commonjs',
      main,
      engines,
      dependencies,
    },
    null,
    2,
  )}\n`;
}

function writeStagingDescriptor({
  projectId,
  sourceSha,
  unresolved,
  resolved,
  externalImports,
  dependencies,
}) {
  return `${JSON.stringify(
    {
      schema: 'guardentra.mail_worker_staging_descriptor.v1',
      target: ALLOWED_TARGET,
      projectId,
      codebase: CODEBASE_NAME,
      runtime: 'nodejs22',
      entry: 'index.cjs',
      exports: ['deliverMail', 'recoverMail'],
      sourceSha,
      mailWorkerEnabled: false,
      note:
        'Staging-only descriptor for a separate Functions codebase. Not wired into root firebase.json. Do not deploy from this preparation alone.',
      firebase: {
        functions: [
          {
            source: '.',
            codebase: CODEBASE_NAME,
            runtime: 'nodejs22',
            ignore: [
              'firebase.json',
              'staging.descriptor.json',
              '**/.*',
              '**/node_modules/**',
            ],
          },
        ],
      },
      params: {
        MAIL_WORKER_ENABLED: false,
        MAIL_WORKER_DATABASE: resolved.database,
        MAIL_WORKER_REGION: resolved.region,
        MAIL_WORKER_SERVICE_ACCOUNT: resolved.serviceAccount,
        MAIL_FROM: resolved.mailFrom,
        MAIL_PROVIDER_REGION: resolved.providerRegion,
        MAIL_WORKER_CUTOVER_AT: resolved.cutoverAt,
        SENDGRID_API_KEY_SECRET: resolved.secretName,
      },
      unresolvedInputs: unresolved,
      externalImports,
      dependencies,
    },
    null,
    2,
  )}\n`;
}

export function smokeCleanInstallAndLoad(packageDir, { runNpmCi, loadModule } = {}) {
  if (typeof runNpmCi === 'function') {
    runNpmCi(packageDir);
  } else {
    // Prefer lockfile install; fall back to install when generating the lock first time.
    const hasLock = fs.existsSync(path.join(packageDir, 'package-lock.json'));
    if (hasLock) {
      runCommand('npm', ['ci', '--ignore-scripts'], packageDir, 'npm ci (mail package)');
    } else {
      runCommand('npm', ['install', '--ignore-scripts', '--package-lock-only=false'], packageDir, 'npm install (mail package)');
    }
  }

  const loader =
    loadModule ||
    ((dir) => {
      const require = createRequire(path.join(dir, 'package.json'));
      // Clear cache so repeated smokes in one process see fresh files.
      const resolved = require.resolve('./index.cjs');
      delete require.cache[resolved];
      return require('./index.cjs');
    });

  const mod = loader(packageDir);
  if (!mod || typeof mod.deliverMail === 'undefined' || typeof mod.recoverMail === 'undefined') {
    throw new PrepareError(
      'EXPORTS_MISSING',
      'Packaged entrypoint must export deliverMail and recoverMail',
    );
  }
  return { exports: ['deliverMail', 'recoverMail'] };
}

/**
 * Generate a lockfile for the isolated package using the same registry resolution
 * as a clean install, without leaving node_modules in the upload context.
 */
function materializeIsolatedLockfile(packageDir, { runNpmInstall }) {
  if (typeof runNpmInstall === 'function') {
    runNpmInstall(packageDir);
    return;
  }
  runCommand(
    'npm',
    ['install', '--ignore-scripts', '--no-fund', '--no-audit'],
    packageDir,
    'npm install (generate mail package lock)',
  );
  const nm = path.join(packageDir, 'node_modules');
  if (fs.existsSync(nm)) {
    fs.rmSync(nm, { recursive: true, force: true });
  }
}

export function prepareMailWorkerPackage(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  const outDir = options.outDir && path.resolve(options.outDir);
  const receiptPath = options.receipt && path.resolve(options.receipt);

  if (!outDir) throw new PrepareError('MISSING_OUT_DIR', 'Require --out-dir');
  if (!receiptPath) throw new PrepareError('MISSING_RECEIPT', 'Require --receipt path');

  assertTarget(options.target, options.projectId);
  const sourceSha = assertSourceSha(repoRoot, options.sourceSha, options.gitRevParse);

  const resolvedOut = path.resolve(outDir);
  const resolvedReceipt = path.resolve(receiptPath);
  if (resolvedReceipt === resolvedOut || resolvedReceipt.startsWith(resolvedOut + path.sep)) {
    throw new PrepareError(
      'RECEIPT_IN_PACKAGE',
      'Receipt must be written outside the package upload context (--out-dir)',
    );
  }

  const { unresolved, resolved } = collectUnresolvedInputs(options);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });

  const bundlePath =
    options.bundlePath ||
    buildMailWorkerBundle(repoRoot, { runNpmBuild: options.runNpmBuild });
  const bundleSource = fs.readFileSync(bundlePath, 'utf8');
  const externalImports = extractExternalImports(bundleSource);
  if (externalImports.length === 0) {
    throw new PrepareError('NO_EXTERNALS', 'Bundle has no external imports to package');
  }

  const lockfile = options.lockfile || JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
  const dependencies = resolveDependencyVersions(lockfile, externalImports);

  const packageJsonText = writePackageManifest({
    name: CODEBASE_NAME,
    engines: { node: '22' },
    dependencies,
    main: 'index.cjs',
  });

  const stagedBundle = path.join(outDir, 'index.cjs');
  fs.writeFileSync(stagedBundle, bundleSource);
  fs.writeFileSync(path.join(outDir, 'package.json'), packageJsonText);

  const descriptorText = writeStagingDescriptor({
    projectId: options.projectId,
    sourceSha,
    unresolved,
    resolved,
    externalImports,
    dependencies,
  });
  fs.writeFileSync(path.join(outDir, 'staging.descriptor.json'), descriptorText);
  fs.writeFileSync(
    path.join(outDir, 'firebase.json'),
    `${JSON.stringify(JSON.parse(descriptorText).firebase, null, 2)}\n`,
  );

  materializeIsolatedLockfile(outDir, { runNpmInstall: options.runNpmInstall });

  if (!fs.existsSync(path.join(outDir, 'package-lock.json'))) {
    throw new PrepareError('LOCK_MISSING', 'Isolated package-lock.json was not produced');
  }

  // Upload context must not retain install trees or secrets.
  const nm = path.join(outDir, 'node_modules');
  if (fs.existsSync(nm)) fs.rmSync(nm, { recursive: true, force: true });

  let smoke = { cleanInstall: false, loadExports: [] };
  if (!options.skipSmoke) {
    const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardentra-mail-smoke-'));
    try {
      for (const file of ['index.cjs', 'package.json', 'package-lock.json']) {
        fs.copyFileSync(path.join(outDir, file), path.join(smokeDir, file));
      }
      smoke = {
        cleanInstall: true,
        loadExports: smokeCleanInstallAndLoad(smokeDir, {
          runNpmCi: options.runNpmCi,
          loadModule: options.loadModule,
        }).exports,
      };
    } finally {
      fs.rmSync(smokeDir, { recursive: true, force: true });
    }
  }

  assertNoExcludedPaths(outDir);

  // Ensure root firebase.json was not modified by this preparation.
  const rootFirebase = path.join(repoRoot, 'firebase.json');
  if (fs.existsSync(rootFirebase)) {
    const rootCfg = JSON.parse(fs.readFileSync(rootFirebase, 'utf8'));
    if (rootCfg.functions) {
      throw new PrepareError(
        'ROOT_FIREBASE_WIRED',
        'Root firebase.json must not gain a functions codebase from mail package prep',
      );
    }
  }

  const receipt = {
    schema: 'guardentra.mail_worker_package_receipt.v1',
    sourceSha,
    target: ALLOWED_TARGET,
    projectId: options.projectId,
    codebase: CODEBASE_NAME,
    preparedAt: new Date().toISOString(),
    mailWorkerEnabled: false,
    compiler: {
      command: 'npm run build:mail-worker',
      outfile: BUNDLE_REL.replace(/\\/g, '/'),
      format: 'cjs',
      packages: 'external',
      nodeEngine: '22',
    },
    externalImports,
    dependencies,
    unresolvedInputs: unresolved,
    artifacts: {
      packageDir: resolvedOut,
      bundle: path.join(resolvedOut, 'index.cjs'),
      packageJson: path.join(resolvedOut, 'package.json'),
      packageLock: path.join(resolvedOut, 'package-lock.json'),
      stagingDescriptor: path.join(resolvedOut, 'staging.descriptor.json'),
      firebaseJson: path.join(resolvedOut, 'firebase.json'),
      receipt: resolvedReceipt,
    },
    hashes: {
      bundle: sha256File(path.join(outDir, 'index.cjs')),
      packageJson: sha256Text(packageJsonText),
      packageLock: sha256File(path.join(outDir, 'package-lock.json')),
      stagingDescriptor: sha256Text(descriptorText),
    },
    smoke,
    exclusions:
      '.env, tokens, keys, terraform, git metadata, node_modules, unrelated app source',
  };

  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const receipt = prepareMailWorkerPackage({
      ...args,
      repoRoot: args.repoRoot || DEFAULT_REPO_ROOT,
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          sourceSha: receipt.sourceSha,
          packageDir: receipt.artifacts.packageDir,
          receipt: receipt.artifacts.receipt,
          unresolvedInputs: receipt.unresolvedInputs,
          mailWorkerEnabled: false,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    const code = error?.code || 'PREPARE_FAILED';
    process.stderr.write(`${code}: ${error.message}\n`);
    process.exitCode = 1;
  }
}

const isDirect =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isDirect) {
  main();
}
