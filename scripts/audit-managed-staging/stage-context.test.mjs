import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stageContext } from './stage-context.mjs';

const source = fileURLToPath(new URL('../../', import.meta.url));
const digest = 'sha256:' + 'a'.repeat(64); // Synthetic digest; no image/network/build.
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture() {
  const repo = await mkdtemp(path.join(tmpdir(), 'ge-context-fixture-'));
  const git = args => execFileSync('git', ['-C', repo, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  await mkdir(path.join(repo, 'scripts/audit-managed-staging'), { recursive: true });
  await mkdir(path.join(repo, 'migrations/audit'), { recursive: true });
  for (const name of ['Dockerfile', 'package.json', 'package-lock.json', 'core.mjs', 'run.mjs', 'manifest.json']) {
    const relative = `scripts/audit-managed-staging/${name}`;
    await writeFile(path.join(repo, relative), await readFile(path.join(source, relative)));
  }
  for (const name of ['001_init.sql', '002_roles.sql']) {
    const relative = `migrations/audit/${name}`;
    await writeFile(path.join(repo, relative), await readFile(path.join(source, relative)));
  }
  await writeFile(path.join(repo, '.env'), 'SYNTHETIC_DECOY=never-upload\n');
  await writeFile(path.join(repo, 'terraform.tfstate'), '{"synthetic":"never-upload"}\n');
  git(['init', '--quiet']); git(['add', '.']);
  const commit = () => {
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      'commit', '--quiet', '-m', 'Disposable fixture']);
    return git(['rev-parse', 'HEAD']);
  };
  return { repo, git, commit, sha: commit() };
}

test('stages only reviewed committed bytes, excluding tracked decoys and dirty files', async () => {
  const f = await fixture(); let staged;
  try {
    await writeFile(path.join(f.repo, 'scripts/audit-managed-staging/run.mjs'), 'DIRTY_DECOY');
    staged = await stageContext(f.repo, f.sha, digest);
    assert.equal(staged.fileCount, 8);
    assert.deepEqual((await readdir(staged.context)).sort(),
      ['Dockerfile', 'core.mjs', 'manifest.json', 'migrations', 'package-lock.json', 'package.json', 'run.mjs']);
    assert.deepEqual((await readdir(path.join(staged.context, 'migrations'))).sort(), ['001_init.sql', '002_roles.sql']);
    const run = await readFile(path.join(staged.context, 'run.mjs'));
    assert.equal(run.toString(), f.git(['show', `${f.sha}:scripts/audit-managed-staging/run.mjs`]) + '\n');
    assert.match(await readFile(path.join(staged.context, 'Dockerfile'), 'utf8'),
      new RegExp(`FROM node:22-bookworm-slim@${digest}`));
    const receipt = JSON.parse(await readFile(staged.receipt, 'utf8'));
    assert.equal(receipt.sourceCommit, f.sha);
    assert.equal(receipt.files['run.mjs'], hash(run));
    assert.equal(path.dirname(staged.receipt), path.dirname(staged.context));
  } finally {
    await rm(f.repo, { recursive: true, force: true });
    if (staged) await rm(path.dirname(staged.context), { recursive: true, force: true });
  }
});

test('rejects mutable references, missing digest, tampered committed SQL and extra migrations', async () => {
  const f = await fixture();
  try {
    await assert.rejects(stageContext(f.repo, 'HEAD', digest), /Exact commit/);
    await assert.rejects(stageContext(f.repo, f.sha, 'latest'), /digest/);
    await writeFile(path.join(f.repo, 'migrations/audit/001_init.sql'), 'SELECT 1;\n');
    f.git(['add', '.']); const changed = f.commit();
    await assert.rejects(stageContext(f.repo, changed, digest), /checksum/);
    await writeFile(path.join(f.repo, 'migrations/audit/003_extra.sql'), 'SELECT 1;\n');
    f.git(['add', '.']); const extra = f.commit();
    await assert.rejects(stageContext(f.repo, extra, digest), /Migration set/);
  } finally { await rm(f.repo, { recursive: true, force: true }); }
});
