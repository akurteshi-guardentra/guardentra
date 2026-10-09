import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { migrationDigest } from './core.mjs';

const files = ['Dockerfile', 'package.json', 'package-lock.json', 'core.mjs',
  'run.mjs', 'manifest.json'];
const migrations = ['001_init.sql', '002_roles.sql'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Reads Git objects only: never the working tree, archive, .env or Terraform files.
export async function stageContext(repo, commit, baseDigest) {
  if (!/^[a-f0-9]{40}$/.test(commit) || !/^sha256:[a-f0-9]{64}$/.test(baseDigest)) {
    throw new Error('Exact commit and Node base-image digest required');
  }
  const git = args => execFileSync('git', ['-C', repo, ...args],
    { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  if (git(['rev-parse', '--verify', `${commit}^{commit}`]).toString().trim() !== commit) {
    throw new Error('Source commit mismatch');
  }
  const sqlNames = git(['ls-tree', '-r', '--name-only', commit, '--', 'migrations/audit'])
    .toString().trim().split('\n').filter(name => name.endsWith('.sql')).sort();
  if (JSON.stringify(sqlNames) !== JSON.stringify(migrations.map(name => `migrations/audit/${name}`))) {
    throw new Error('Migration set differs from reviewed set');
  }
  const contents = new Map(files.map(name => [name,
    git(['show', `${commit}:scripts/audit-managed-staging/${name}`])]));
  const manifest = JSON.parse(contents.get('manifest.json').toString('utf8'));
  if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(migrations)) {
    throw new Error('Migration manifest set mismatch');
  }
  for (const name of migrations) {
    const bytes = git(['show', `${commit}:migrations/audit/${name}`]);
    if (migrationDigest(bytes.toString('utf8')) !== manifest[name]) {
      throw new Error('Committed migration checksum mismatch');
    }
    contents.set(`migrations/${name}`, bytes);
  }
  const dockerfile = contents.get('Dockerfile').toString('utf8');
  const from = dockerfile.split(/\r?\n/).filter(line => /^FROM\s/i.test(line));
  if (from.length !== 1 || from[0] !== 'FROM node:22-bookworm-slim') {
    throw new Error('Dockerfile base differs from reviewed template');
  }
  const baseImage = `node:22-bookworm-slim@${baseDigest}`;
  contents.set('Dockerfile', Buffer.from(dockerfile.replace(from[0], `FROM ${baseImage}`)));

  const parent = await mkdtemp(path.join(tmpdir(), 'guardentra-audit-build-74-'));
  const context = path.join(parent, 'context');
  try {
    await mkdir(path.join(context, 'migrations'), { recursive: true, mode: 0o700 });
    const hashes = {};
    for (const [name, bytes] of contents) {
      await writeFile(path.join(context, name), bytes, { flag: 'wx', mode: 0o600 });
      hashes[name] = sha256(bytes);
    }
    const receipt = path.join(parent, 'receipt.json');
    await writeFile(receipt, JSON.stringify({ sourceCommit: commit, baseImage,
      dockerfileTransformed: 'Pinned base digest only', files: hashes }, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 });
    return { context, receipt, sourceCommit: commit, baseImage, fileCount: contents.size };
  } catch (error) {
    await rm(parent, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 5) throw new Error('Expected repository, commit and base digest');
    console.log(JSON.stringify(await stageContext(...process.argv.slice(2)), null, 2));
  } catch {
    console.error('Build context staging failed; check reviewed source and base-image digest.');
    process.exitCode = 1;
  }
}
