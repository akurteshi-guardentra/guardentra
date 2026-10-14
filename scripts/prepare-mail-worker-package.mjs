/**
 * Prepare an isolated Firebase Functions codebase (`guardentra-mail`) for the
 * self-managed mail worker. Source preparation only - does not deploy, enable
 * email, bind secrets, or contact providers/GCP.
 *
 * Bytes are taken from `git archive` of `--source-sha`, not from a dirty
 * working tree. The isolated lockfile is a closure copied from that commit's
 * package-lock.json. This script never recursively deletes an output path it
 * did not create in this invocation.
 *
 * Usage:
 *   node scripts/prepare-mail-worker-package.mjs \
 *     --source-sha <40-char-sha> \
 *     --target staging \
 *     --project-id guardentra-staging \
 *     --out-dir <new-upload-context-dir> \
 *     --receipt <new-path-outside-out-dir>
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
    super(`${code}: ${message}`);
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

function parentLockKey(key) {
  if (!key) return null;
  const marker = '/node_modules/';
  const idx = key.lastIndexOf(marker);
  if (idx === -1) return '';
  return key.slice(0, idx);
}

function lookupLockKey(packages, fromKey, depName) {
  let scope = fromKey;
  for (;;) {
    const candidate = scope ? `${scope}/node_modules/${depName}` : `node_modules/${depName}`;
    if (packages[candidate]) return candidate;
    if (!scope) return null;
    const parent = parentLockKey(scope);
    if (parent === null) return null;
    scope = parent;
  }
}

function enqueueDependencies(sourcePackages, fromKey, entry, queue) {
  for (const depName of Object.keys(entry?.dependencies || {})) {
    const depKey = lookupLockKey(sourcePackages, fromKey, depName);
    if (!depKey) {
      throw new PrepareError(
        'LOCKFILE_MISS',
        `Transitive dependency ${depName} of ${fromKey} missing from source lock`,
      );
    }
    queue.push(depKey);
  }
  for (const depName of Object.keys(entry?.optionalDependencies || {})) {
    const depKey = lookupLockKey(sourcePackages, fromKey, depName);
    if (depKey) queue.push(depKey);
  }
}

/**
 * Copy the reviewed lockfile's transitive closure. Does not run npm install.
 * @param {object} rootLock
 * @param {Record<string, string>} directVersions exact versions from the source lock
 */
export function buildIsolatedLockfile(rootLock, directVersions) {
  if (rootLock?.lockfileVersion !== 3) {
    throw new PrepareError('LOCKFILE_UNSUPPORTED', 'Source lockfile must be lockfileVersion 3');
  }
  const sourcePackages = rootLock.packages || {};
  const isolatedPackages = {
    '': {
      name: CODEBASE_NAME,
      version: '0.0.0',
      private: true,
      dependencies: { ...directVersions },
    },
  };
  const queue = [];
  for (const [name, version] of Object.entries(directVersions)) {
    const key = `node_modules/${name}`;
    const entry = sourcePackages[key];
    if (!entry) {
      throw new PrepareError('LOCKFILE_MISS', `Direct dependency ${name} missing from source lock`);
    }
    if (entry.version !== version) {
      throw new PrepareError(
        'LOCK_DRIFT',
        `Direct dependency ${name} version ${version} does not match source lock ${entry.version}`,
      );
    }
    queue.push(key);
  }
  const seen = new Set();
  while (queue.length) {
    const key = queue.pop();
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = sourcePackages[key];
    if (!entry) {
      throw new PrepareError('LOCKFILE_MISS', `Lock closure missing ${key}`);
    }
    if (!entry.integrity || !entry.resolved || !entry.version) {
      throw new PrepareError('LOCK_UNBOUND', `Lock entry ${key} has no reviewed integrity metadata`);
    }
    isolatedPackages[key] = JSON.parse(JSON.stringify(entry));
    enqueueDependencies(sourcePackages, key, entry, queue);
  }
  const isolated = {
    name: CODEBASE_NAME,
    lockfileVersion: 3,
    requires: true,
    packages: isolatedPackages,
  };
  assertClosureBoundToSource(isolated, rootLock);
  return isolated;
}

export function assertClosureBoundToSource(isolatedLock, sourceLock) {
  const sourcePackages = sourceLock.packages || {};
  for (const [key, entry] of Object.entries(isolatedLock.packages || {})) {
    if (key === '') continue;
    const source = sourcePackages[key];
    if (!source) {
      throw new PrepareError('LOCK_DRIFT', `Isolated lock contains ${key} which is absent from the source lock`);
    }
    if (entry.version !== source.version || entry.integrity !== source.integrity || entry.resolved !== source.resolved) {
      throw new PrepareError('LOCK_DRIFT', `Isolated lock entry ${key} does not match the source lock`);
    }
  }
}

function lstatIfExists(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function classifyPath(targetPath) {
  const resolved = path.resolve(targetPath);
  const root = path.parse(resolved).root;
  const parts = resolved.slice(root.length).split(path.sep).filter(Boolean);
  let current = root;
  let realCursor = fs.realpathSync(root);
  for (let i = 0; i < parts.length; i += 1) {
    current = path.join(current, parts[i]);
    const stat = lstatIfExists(current);
    const isFinal = i === parts.length - 1;
    if (!stat) {
      const rest = parts.slice(i);
      return {
        requested: resolved,
        canonical: path.resolve(realCursor, ...rest),
        exists: false,
        linked: false,
      };
    }
    if (stat.isSymbolicLink()) {
      return { requested: resolved, canonical: current, exists: true, linked: true };
    }
    if (!stat.isDirectory() && !isFinal) {
      return { requested: resolved, canonical: current, exists: true, linked: false, notDirectory: true };
    }
    realCursor = fs.realpathSync(current);
  }
  return { requested: resolved, canonical: realCursor, exists: true, linked: false };
}

function sameOrInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

function overlaps(a, b) {
  return sameOrInside(a, b) || sameOrInside(b, a);
}

/**
 * Refuse existing, linked, checkout-overlapping, or protected output/receipt paths.
 * Does not delete anything.
 */
export function assertSafeNewPath(targetPath, repoRoot, role) {
  const repoReal = fs.realpathSync(repoRoot);
  const classified = classifyPath(targetPath);
  if (classified.linked) {
    throw new PrepareError('LINKED_PATH', `${role} path follows a symlink and was refused: ${classified.requested}`);
  }
  if (classified.notDirectory) {
    throw new PrepareError('OUTPUT_PARENT_NOT_DIR', `${role} parent is not a directory: ${classified.canonical}`);
  }
  if (overlaps(classified.canonical, repoReal)) {
    throw new PrepareError('PATH_OVERLAP', `${role} path overlaps the source checkout and was refused`);
  }
  const fsRoot = path.parse(classified.canonical).root;
  const home = fs.realpathSync(os.homedir());
  if (
    classified.canonical === fsRoot ||
    classified.canonical === home ||
    path.dirname(classified.canonical) === fsRoot
  ) {
    throw new PrepareError('PROTECTED_PATH', `${role} path is a protected location and was refused`);
  }
  if (classified.exists) {
    throw new PrepareError(
      role === 'receipt' ? 'RECEIPT_EXISTS' : 'OUTPUT_EXISTS',
      `${role} path already exists and was refused without deletion: ${classified.requested}`,
    );
  }
  return classified.canonical;
}

function mkdirExclusive(dir) {
  const parent = path.dirname(dir);
  if (!lstatIfExists(parent)) {
    mkdirExclusive(parent);
  }
  const parentStat = fs.lstatSync(parent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new PrepareError('LINKED_PATH', `Refusing to create a directory through ${parent}`);
  }
  try {
    fs.mkdirSync(dir);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new PrepareError('OUTPUT_EXISTS', `Path already exists and was refused without deletion: ${dir}`);
    }
    throw error;
  }
}

function assertNoExcludedPaths(dir) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const rel = path.relative(dir, full).replace(/\\/g, '/');
      if (entry.isSymbolicLink()) {
        throw new PrepareError('LINKED_PATH', `Forbidden symlink staged in package: ${rel}`);
      }
      if (EXCLUDED_NAME_RE.test(rel) || EXCLUDED_NAME_RE.test(entry.name)) {
        throw new PrepareError('EXCLUDED_ARTIFACT', `Forbidden path staged in package: ${rel}`);
      }
      if (entry.isDirectory()) stack.push(full);
    }
  }
}

function runCommand(command, args, cwd, label, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    env,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw new PrepareError('COMMAND_FAILED', `${label} failed: ${detail}`);
  }
  return result;
}

function hashInputTree(rootDir) {
  const files = [];
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop();
    const full = path.join(rootDir, rel);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) {
      files.push({ rel: rel.replace(/\\/g, '/'), body: `link:${fs.readlinkSync(full)}` });
      continue;
    }
    if (stat.isDirectory()) {
      if (rel === 'dist' || rel.startsWith(`dist${path.sep}`)) continue;
      for (const name of fs.readdirSync(full)) {
        stack.push(path.join(rel, name));
      }
      continue;
    }
    if (stat.isFile()) {
      files.push({ rel: rel.replace(/\\/g, '/'), body: fs.readFileSync(full) });
    }
  }
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.rel);
    hash.update('\0');
    hash.update(file.body);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function materializeCommit(repoRoot, sourceSha) {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'guardentra-mail-src-'));
  const archive = path.join(dest, 'source.tar');
  const tree = path.join(dest, 'tree');
  fs.mkdirSync(tree);
  const git = spawnSync('git', ['-C', repoRoot, 'archive', '--format=tar', '-o', archive, sourceSha], {
    encoding: 'utf8',
  });
  if (git.status !== 0) {
    fs.rmSync(dest, { recursive: true, force: true });
    throw new PrepareError('GIT_ERROR', git.stderr || 'git archive failed');
  }
  const tar = spawnSync('tar', ['-x', '-C', tree, '-f', archive], { encoding: 'utf8' });
  fs.rmSync(archive, { force: true });
  if (tar.status !== 0) {
    fs.rmSync(dest, { recursive: true, force: true });
    throw new PrepareError('GIT_ERROR', tar.stderr || 'tar extract failed');
  }
  return { dest, tree };
}

function assertCompiler(tree, repoRoot, lockfile) {
  const pkg = JSON.parse(fs.readFileSync(path.join(tree, 'package.json'), 'utf8'));
  const script = pkg.scripts?.['build:mail-worker'];
  if (!script || typeof script !== 'string') {
    throw new PrepareError('COMPILER_MISSING', 'Committed package.json has no build:mail-worker script');
  }
  if (!script.includes('esbuild')) {
    return { script, esbuildVersion: null, binDir: null };
  }
  const locked = lockfile.packages?.['node_modules/esbuild']?.version || null;
  const installedPath = path.join(repoRoot, 'node_modules', 'esbuild', 'package.json');
  if (!locked || !fs.existsSync(installedPath)) {
    throw new PrepareError(
      'COMPILER_MISSING',
      'esbuild is required at the version recorded in the source lockfile',
    );
  }
  const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8')).version;
  if (installed !== locked) {
    throw new PrepareError(
      'COMPILER_MISMATCH',
      `Installed esbuild ${installed} does not match source lock ${locked}`,
    );
  }
  return {
    script,
    esbuildVersion: installed,
    binDir: path.join(repoRoot, 'node_modules', '.bin'),
  };
}

export function buildMailWorkerBundle(repoRoot, { runNpmBuild, binDir } = {}) {
  if (typeof runNpmBuild === 'function') {
    runNpmBuild(repoRoot);
  } else {
    const env = { ...process.env, npm_config_ignore_scripts: 'true' };
    if (binDir) env.PATH = `${binDir}${path.delimiter}${env.PATH || ''}`;
    runCommand('npm', ['run', 'build:mail-worker'], repoRoot, 'npm run build:mail-worker', env);
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
      exports: ['deliverMail', 'recoverMail', 'handleMailCreated', 'handleMailRecovery'],
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

function toolVersion(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', shell: false });
  if (result.status !== 0) {
    throw new PrepareError('COMMAND_FAILED', `${command} --version failed`);
  }
  return result.stdout.trim();
}

export function smokeCleanInstallAndLoad(packageDir, { runNpmCi, loadModule } = {}) {
  if (typeof runNpmCi === 'function') {
    runNpmCi(packageDir);
  } else {
    const hasLock = fs.existsSync(path.join(packageDir, 'package-lock.json'));
    if (!hasLock) {
      throw new PrepareError('LOCK_MISSING', 'Clean install requires the reviewed package-lock.json');
    }
    runCommand('npm', ['ci', '--ignore-scripts'], packageDir, 'npm ci (mail package)');
  }

  const loader =
    loadModule ||
    ((dir) => {
      const require = createRequire(path.join(dir, 'package.json'));
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

function writeIsolatedLock(packageDir, rootLock, dependencies) {
  const isolated = buildIsolatedLockfile(rootLock, dependencies);
  const text = `${JSON.stringify(isolated, null, 2)}\n`;
  fs.writeFileSync(path.join(packageDir, 'package-lock.json'), text);
  return { isolated, text };
}

export function prepareMailWorkerPackage(options = {}) {
  const fixtureMode = options.fixtureMode === true;
  const repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  const outDir = options.outDir && path.resolve(options.outDir);
  const receiptPath = options.receipt && path.resolve(options.receipt);

  if (!outDir) throw new PrepareError('MISSING_OUT_DIR', 'Require --out-dir');
  if (!receiptPath) throw new PrepareError('MISSING_RECEIPT', 'Require --receipt path');

  assertTarget(options.target, options.projectId);
  const sourceSha = assertSourceSha(
    repoRoot,
    options.sourceSha,
    fixtureMode ? options.gitRevParse : undefined,
  );

  const canonicalOut = assertSafeNewPath(outDir, repoRoot, 'output');
  const canonicalReceipt = assertSafeNewPath(receiptPath, repoRoot, 'receipt');
  if (canonicalReceipt === canonicalOut || sameOrInside(canonicalOut, canonicalReceipt)) {
    throw new PrepareError(
      'RECEIPT_IN_PACKAGE',
      'Receipt must be written outside the package upload context (--out-dir)',
    );
  }

  const { unresolved, resolved } = collectUnresolvedInputs(options);
  const firebaseBefore = fs.existsSync(path.join(repoRoot, 'firebase.json'))
    ? sha256File(path.join(repoRoot, 'firebase.json'))
    : null;

  let ownedTemp = null;
  try {
    let buildRoot = repoRoot;
    let lockfile;
    let sourceLockHash = null;
    let compiler = { script: 'npm run build:mail-worker', esbuildVersion: null, binDir: null };
    let inputIdentity = null;

    if (fixtureMode) {
      lockfile = options.lockfile;
      if (!lockfile) {
        throw new PrepareError('LOCKFILE_MISS', 'Fixture mode requires an explicit lockfile object');
      }
    } else {
      const materialized = materializeCommit(repoRoot, sourceSha);
      ownedTemp = materialized.dest;
      buildRoot = materialized.tree;
      const lockPath = path.join(buildRoot, 'package-lock.json');
      if (!fs.existsSync(lockPath)) {
        throw new PrepareError('LOCKFILE_MISS', 'Committed package-lock.json is missing');
      }
      sourceLockHash = sha256File(lockPath);
      lockfile = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      compiler = assertCompiler(buildRoot, repoRoot, lockfile);
      const before = hashInputTree(buildRoot);
      const runNpmBuild = options.testHooks === true ? options.runNpmBuild : undefined;
      buildMailWorkerBundle(buildRoot, { runNpmBuild, binDir: compiler.binDir });
      const after = hashInputTree(buildRoot);
      if (before !== after) {
        throw new PrepareError(
          'SOURCE_CHANGED',
          'Packaged inputs changed during preparation; refusing to publish a mixed tree',
        );
      }
      inputIdentity = { algorithm: 'sha256-tree-v1', before, after };
    }

    const bundlePath = fixtureMode
      ? options.bundlePath || buildMailWorkerBundle(repoRoot, { runNpmBuild: options.runNpmBuild })
      : path.join(buildRoot, BUNDLE_REL);
    const bundleSource = fs.readFileSync(bundlePath, 'utf8');
    const externalImports = extractExternalImports(bundleSource);
    if (externalImports.length === 0) {
      throw new PrepareError('NO_EXTERNALS', 'Bundle has no external imports to package');
    }
    const dependencies = resolveDependencyVersions(lockfile, externalImports);

    mkdirExclusive(canonicalOut);
    mkdirExclusive(path.dirname(canonicalReceipt));

    const packageJsonText = writePackageManifest({
      name: CODEBASE_NAME,
      engines: { node: '22' },
      dependencies,
      main: 'index.cjs',
    });
    fs.writeFileSync(path.join(canonicalOut, 'index.cjs'), bundleSource);
    fs.writeFileSync(path.join(canonicalOut, 'package.json'), packageJsonText);

    const descriptorText = writeStagingDescriptor({
      projectId: options.projectId,
      sourceSha,
      unresolved,
      resolved,
      externalImports,
      dependencies,
    });
    fs.writeFileSync(path.join(canonicalOut, 'staging.descriptor.json'), descriptorText);
    fs.writeFileSync(
      path.join(canonicalOut, 'firebase.json'),
      `${JSON.stringify(JSON.parse(descriptorText).firebase, null, 2)}\n`,
    );

    let isolatedLockText;
    if (fixtureMode && typeof options.runNpmInstall === 'function') {
      options.runNpmInstall(canonicalOut);
      isolatedLockText = fs.readFileSync(path.join(canonicalOut, 'package-lock.json'), 'utf8');
    } else {
      isolatedLockText = writeIsolatedLock(canonicalOut, lockfile, dependencies).text;
    }
    if (!fs.existsSync(path.join(canonicalOut, 'package-lock.json'))) {
      throw new PrepareError('LOCK_MISSING', 'Isolated package-lock.json was not produced');
    }

    let smoke = { kind: 'not-run', cleanInstall: false, loadExports: [] };
    if (!options.skipSmoke) {
      const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardentra-mail-smoke-'));
      try {
        for (const file of ['index.cjs', 'package.json', 'package-lock.json']) {
          fs.copyFileSync(path.join(canonicalOut, file), path.join(smokeDir, file));
        }
        smoke = {
          kind: fixtureMode ? 'fixture' : 'temporary-copy',
          cleanInstall: true,
          loadExports: smokeCleanInstallAndLoad(smokeDir, {
            runNpmCi: fixtureMode ? options.runNpmCi : undefined,
            loadModule: fixtureMode ? options.loadModule : undefined,
          }).exports,
        };
      } finally {
        fs.rmSync(smokeDir, { recursive: true, force: true });
      }
    }

    assertNoExcludedPaths(canonicalOut);

    const materializedFirebase = path.join(fixtureMode ? repoRoot : buildRoot, 'firebase.json');
    if (fs.existsSync(materializedFirebase)) {
      const rootCfg = JSON.parse(fs.readFileSync(materializedFirebase, 'utf8'));
      if (rootCfg.functions) {
        throw new PrepareError(
          'ROOT_FIREBASE_WIRED',
          'Committed firebase.json must not contain a functions codebase',
        );
      }
    }
    const firebaseAfter = fs.existsSync(path.join(repoRoot, 'firebase.json'))
      ? sha256File(path.join(repoRoot, 'firebase.json'))
      : null;
    if (firebaseBefore !== firebaseAfter) {
      throw new PrepareError('SOURCE_CHANGED', 'Working tree firebase.json changed during preparation');
    }

    const receipt = {
      schema: 'guardentra.mail_worker_package_receipt.v1',
      sourceSha,
      target: ALLOWED_TARGET,
      projectId: options.projectId,
      codebase: CODEBASE_NAME,
      preparedAt: new Date().toISOString(),
      mailWorkerEnabled: false,
      sourceBinding: fixtureMode ? 'fixture' : 'git-archive',
      compiler: {
        command: compiler.script,
        outfile: BUNDLE_REL.replace(/\\/g, '/'),
        format: 'cjs',
        packages: 'external',
        nodeEngine: '22',
        esbuildVersion: compiler.esbuildVersion,
      },
      provenance: {
        sourceLockSha256: sourceLockHash,
        isolatedLockSha256: sha256Text(isolatedLockText),
        node: process.version,
        npm: toolVersion('npm'),
      },
      inputIdentity,
      externalImports,
      dependencies,
      unresolvedInputs: unresolved,
      artifacts: {
        packageDir: canonicalOut,
        bundle: path.join(canonicalOut, 'index.cjs'),
        packageJson: path.join(canonicalOut, 'package.json'),
        packageLock: path.join(canonicalOut, 'package-lock.json'),
        stagingDescriptor: path.join(canonicalOut, 'staging.descriptor.json'),
        firebaseJson: path.join(canonicalOut, 'firebase.json'),
        receipt: canonicalReceipt,
      },
      hashes: {
        bundle: sha256File(path.join(canonicalOut, 'index.cjs')),
        packageJson: sha256Text(packageJsonText),
        packageLock: sha256File(path.join(canonicalOut, 'package-lock.json')),
        stagingDescriptor: sha256Text(descriptorText),
      },
      smoke,
      exclusions:
        '.env, tokens, keys, terraform, git metadata, node_modules, unrelated app source',
    };

    fs.writeFileSync(canonicalReceipt, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
    return receipt;
  } finally {
    if (ownedTemp) fs.rmSync(ownedTemp, { recursive: true, force: true });
  }
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const receipt = prepareMailWorkerPackage({
      sourceSha: args.sourceSha,
      target: args.target,
      projectId: args.projectId,
      outDir: args.outDir,
      receipt: args.receipt,
      database: args.database,
      region: args.region,
      serviceAccount: args.serviceAccount,
      mailFrom: args.mailFrom,
      providerRegion: args.providerRegion,
      cutoverAt: args.cutoverAt,
      secretName: args.secretName,
      skipSmoke: args.skipSmoke,
      repoRoot: args.repoRoot || DEFAULT_REPO_ROOT,
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          sourceSha: receipt.sourceSha,
          sourceBinding: receipt.sourceBinding,
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
