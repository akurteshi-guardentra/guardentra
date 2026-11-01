// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  applyReport, buildReport, classifyMail, DEFAULT_MIN_AGE_MS, type MailInventoryEntry,
} from '../../server/lib/mailWorker/reconcile';
import { WORKER_OWNER } from '../../server/lib/mailWorker/worker';
import { main, resolveConfig, type ReconcileDeps } from '../../scripts/mail-reconcile';

const CUT = Date.parse('2026-11-01T15:00:00Z');
const NOW = CUT + 60 * 60_000;
const opts = { cutoverMs: CUT, nowMs: NOW, minAgeMs: DEFAULT_MIN_AGE_MS };
const owned = (state: string, code: string | null = null) => ({ owner: WORKER_OWNER, state, code, attempts: 1 });

describe('classifyMail', () => {
  it('only an old-enough, post-cutover doc with no delivery is a candidate', () => {
    expect(classifyMail({ id: 'a', createdAtMs: CUT, delivery: undefined }, opts)).toBe('CANDIDATE');
    expect(classifyMail({ id: 'b', createdAtMs: CUT - 1, delivery: undefined }, opts)).toBe('PRE_CUTOVER_UNDELIVERED');
    expect(classifyMail({ id: 'c', createdAtMs: NOW - 1000, delivery: undefined }, opts)).toBe('RECENT_UNCLAIMED');
  });
  it('never treats an extension-finished or malformed delivery as a candidate', () => {
    for (const delivery of [{ state: 'SUCCESS' }, { owner: 'other', state: 'ERROR' }, null, 'x', []]) {
      expect(classifyMail({ id: 'x', createdAtMs: NOW - DEFAULT_MIN_AGE_MS, delivery }, opts)).toBe('FOREIGN_DELIVERY');
    }
  });
  it('splits worker-owned docs into review classes and count-only', () => {
    expect(classifyMail({ id: 'p', createdAtMs: CUT, delivery: owned('PROCESSING') }, opts)).toBe('WORKER_PROCESSING');
    expect(classifyMail({ id: 'u', createdAtMs: CUT, delivery: owned('ERROR', 'OUTCOME_UNKNOWN') }, opts)).toBe('WORKER_OUTCOME_UNKNOWN');
    for (const d of [owned('SUCCESS', 'ACCEPTED'), owned('RETRY', 'RATE_LIMITED'), owned('ERROR', 'PROVIDER_REJECTED')]) {
      expect(classifyMail({ id: 'o', createdAtMs: CUT, delivery: d }, opts)).toBe('WORKER_OTHER');
    }
  });
});

describe('buildReport / applyReport', () => {
  const entries: MailInventoryEntry[] = [
    { id: 'm2', createdAtMs: CUT + 1, delivery: undefined },
    { id: 'm1', createdAtMs: CUT + 2, delivery: undefined },
    { id: 'm1', createdAtMs: CUT + 2, delivery: undefined }, // pagination overlap
    { id: 'old', createdAtMs: CUT - 1, delivery: undefined },
    { id: 'ext', createdAtMs: CUT + 3, delivery: { state: 'SUCCESS' } },
    { id: 'ok', createdAtMs: CUT + 4, delivery: owned('SUCCESS', 'ACCEPTED') },
    { id: 'unk', createdAtMs: CUT + 5, delivery: owned('ERROR', 'OUTCOME_UNKNOWN') },
  ];
  it('reports counts, sorted de-duplicated ids, and never lists count-only classes', () => {
    const r = buildReport(entries, opts);
    expect(r).toMatchObject({ mode: 'dry-run', scanned: 6, cutoverAt: '2026-11-01T15:00:00.000Z' });
    expect(r.counts).toMatchObject({ CANDIDATE: 2, PRE_CUTOVER_UNDELIVERED: 1, FOREIGN_DELIVERY: 1, WORKER_OTHER: 1, WORKER_OUTCOME_UNKNOWN: 1 });
    expect(r.ids).toEqual({ CANDIDATE: ['m1', 'm2'], PRE_CUTOVER_UNDELIVERED: ['old'], WORKER_OUTCOME_UNKNOWN: ['unk'] });
  });
  it('rejects an invalid cutover', () => {
    expect(() => buildReport(entries, { ...opts, cutoverMs: NaN })).toThrow(/CUTOVER_INVALID/);
  });
  it('processes each candidate once, and only candidates', async () => {
    const process = vi.fn(async (_id: string) => 'SUCCESS');
    const r = await applyReport(buildReport(entries, opts), { process, maxApply: 10 });
    expect(process.mock.calls.map(c => c[0])).toEqual(['m1', 'm2']);
    expect(r).toMatchObject({ mode: 'apply', applied: [{ id: 'm1', result: 'SUCCESS' }, { id: 'm2', result: 'SUCCESS' }], notAttempted: [] });
  });
  it('refuses to start above --max', async () => {
    const process = vi.fn(async () => 'SUCCESS');
    await expect(applyReport(buildReport(entries, opts), { process, maxApply: 1 })).rejects.toThrow(/LIMIT_EXCEEDED/);
    expect(process).not.toHaveBeenCalled();
  });
  it('stops at the first failure without leaking error text', async () => {
    const process = vi.fn(async () => { throw new Error('to=vendor@example.test body=secret'); });
    const r = await applyReport(buildReport(entries, opts), { process, maxApply: 10 });
    expect(process).toHaveBeenCalledTimes(1);
    expect(r.applied).toEqual([{ id: 'm1', result: 'FAILED' }]);
    expect(r.notAttempted).toEqual(['m2']);
    expect(JSON.stringify(r)).not.toMatch(/example\.test|secret/);
  });
});

describe('resolveConfig target and flag guards', () => {
  const base = ['--project-id', 'guardentra-staging', '--database', '(default)', '--cutover-at', '2026-11-01T15:00:00Z'];
  const applyFlags = ['--apply', '--confirm-project', 'guardentra-staging', '--mail-from', 'admin@guardentra.com', '--provider-region', 'us'];
  it('defaults to a dry run on staging', () => {
    expect(resolveConfig(base, {})).toMatchObject({ projectId: 'guardentra-staging', apply: null, emulator: false });
  });
  it.each(['guardentra-prod', 'guardentra-7f582', 'demo-x', 'guardentra-staging2'])('refuses project %s off-emulator', p => {
    expect(() => resolveConfig(['--project-id', p, ...base.slice(2)], {})).toThrow(/TARGET_REFUSED/);
  });
  it('allows only demo-* projects on a localhost emulator', () => {
    expect(resolveConfig(['--project-id', 'demo-r', ...base.slice(2)], { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }).emulator).toBe(true);
    expect(() => resolveConfig(base, { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toThrow(/TARGET_REFUSED/);
    expect(() => resolveConfig(['--project-id', 'demo-r', ...base.slice(2)], { FIRESTORE_EMULATOR_HOST: 'evil.example:8080' })).toThrow(/TARGET_REFUSED/);
  });
  it.each([
    [['--project-id', 'guardentra-staging', '--database', '(default)']],
    [[...base.slice(0, 5), '2026-11-01T15:00:00']],
    [[...base.slice(0, 5), '2026-11-01T15:00:00+01:00']],
    [[...base, '--force']],
    [[...base, '--max', '5']],
    [[...base, 'extra']],
    [[...base, '--database', 'x']],
  ])('rejects bad usage %#', argv => {
    expect(() => resolveConfig(argv, {})).toThrow(/USAGE/);
  });
  it('apply needs matching confirmation, sender, region, bounded max and an API key', () => {
    const env = { SENDGRID_API_KEY: 'SG.test' };
    expect(resolveConfig([...base, ...applyFlags], env).apply).toMatchObject({ maxApply: 10, region: 'us' });
    expect(() => resolveConfig([...base, ...applyFlags], {})).toThrow(/SENDGRID_API_KEY/);
    const wrongConfirm = applyFlags.map(a => (a === 'guardentra-staging' ? 'guardentra-prod' : a));
    expect(() => resolveConfig([...base, ...wrongConfirm], env)).toThrow(/confirm-project/);
    expect(() => resolveConfig([...base, ...applyFlags, '--max', '51'], env)).toThrow(/--max/);
    expect(() => resolveConfig([...base, ...applyFlags, '--max', '0'], env)).toThrow(/--max/);
    expect(() => resolveConfig([...base, '--apply', '--confirm-project', 'guardentra-staging'], env)).toThrow(/mail-from/);
  });
});

describe('main', () => {
  const argv = ['--project-id', 'guardentra-staging', '--database', '(default)', '--cutover-at', '2026-11-01T15:00:00Z'];
  function deps(entries: MailInventoryEntry[]) {
    const close = vi.fn(async () => {});
    const createProcess = vi.fn(() => async () => 'SUCCESS');
    const d: ReconcileDeps = {
      openDb: () => ({ db: {} as never, close }), inventory: async () => entries, createProcess, now: () => NOW,
    };
    return { d, close, createProcess };
  }
  it('dry run never builds a provider/worker and prints only ids and counts', async () => {
    const { d, close, createProcess } = deps([{ id: 'lost1', createdAtMs: CUT + 1, delivery: undefined }]);
    let out = '';
    const code = await main(argv, { SENDGRID_API_KEY: 'SG.must-not-appear' }, { out: s => { out += s; }, err: () => {} }, d);
    expect(code).toBe(0);
    expect(createProcess).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    const json = JSON.parse(out);
    expect(json).toMatchObject({ mode: 'dry-run', projectId: 'guardentra-staging', ids: { CANDIDATE: ['lost1'] } });
    expect(out).not.toContain('SG.');
  });
  it('returns 2 with a coded message on refusal, before opening any database', async () => {
    const { d } = deps([]);
    const openDb = vi.spyOn(d, 'openDb');
    let err = '';
    const code = await main(['--project-id', 'guardentra-prod', ...argv.slice(2)], {}, { out: () => {}, err: s => { err += s; } }, d);
    expect(code).toBe(2);
    expect(err).toMatch(/^TARGET_REFUSED/);
    expect(openDb).not.toHaveBeenCalled();
  });
  it('hides SDK error text and still closes the database', async () => {
    const { d, close } = deps([]);
    d.inventory = async () => { throw new Error('PERMISSION_DENIED projects/guardentra-staging/... vendor@example.test'); };
    let err = '';
    expect(await main(argv, {}, { out: () => {}, err: s => { err += s; } }, d)).toBe(1);
    expect(err).toBe('RECONCILE_FAILED\n');
    expect(close).toHaveBeenCalled();
  });
});
