import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAMPLE_SEED_VERSION,
  buildSampleSeedRecords,
  frameworkComplianceDocId,
  sampleDocId,
  seedProfessionalData,
} from '../lib/seeding';
import * as firestore from 'firebase/firestore';

describe('sample seeding structure + idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds deterministic sample document ids scoped to org + version', () => {
    expect(sampleDocId('orgA', 'risks', 'incomplete-vendor-questionnaire')).toBe(
      'orgA__sample_v1__risks__incomplete-vendor-questionnaire'
    );
    expect(frameworkComplianceDocId('orgA', 'iso27001')).toBe('orgA__fw__iso27001');
  });

  it('builds a bounded sample payload with isSample + sampleSeedVersion on every record', () => {
    const records = buildSampleSeedRecords({
      organizationId: 'org_test',
      industry: 'SaaS',
      frameworks: ['iso27001', 'soc2'],
    });
    expect(records.length).toBeGreaterThan(20);
    expect(records.every((r) => r.data.organizationId === 'org_test')).toBe(true);
    expect(records.every((r) => r.data.isSample === true)).toBe(true);
    expect(records.every((r) => r.data.sampleSeedVersion === SAMPLE_SEED_VERSION)).toBe(true);
    const ids = new Set(records.map((r) => `${r.collection}/${r.id}`));
    expect(ids.size).toBe(records.length);
  });

  it('commits sample data in batched write phases (not one addDoc round-trip per record)', async () => {
    const setCalls: Array<{ path: string }> = [];
    const commit = vi.fn(() => Promise.resolve());
    const set = vi.fn((ref: { path?: string }) => {
      setCalls.push({ path: ref?.path || '' });
    });
    vi.mocked(firestore.writeBatch).mockReturnValue({
      set,
      update: vi.fn(),
      delete: vi.fn(),
      commit,
    } as any);
    vi.mocked(firestore.getDoc).mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    } as any);
    vi.mocked(firestore.doc).mockImplementation((_db: unknown, coll: string, id?: string) => {
      if (id) return { id, collection: coll, path: `${coll}/${id}` } as any;
      return { id: 'auto', collection: coll, path: coll } as any;
    });
    vi.mocked(firestore.collection).mockImplementation((_db: unknown, name: string) => ({ id: name, path: name }) as any);

    const records = buildSampleSeedRecords({
      organizationId: 'org_batch',
      industry: 'SaaS',
      frameworks: ['iso27001'],
    });

    const result = await seedProfessionalData({
      organizationId: 'org_batch',
      industry: 'SaaS',
      frameworks: ['iso27001'],
    });

    expect(result.skipped).toBe(false);
    expect(result.batchCommits).toBe(1);
    expect(result.writeCount).toBe(records.length + 1); // + org marker
    expect(commit).toHaveBeenCalledTimes(1);
    expect(firestore.addDoc).not.toHaveBeenCalled();
    // Structural BEFORE: N sequential addDoc awaits (~24+). AFTER: 1 batch commit.
    expect(result.batchCommits).toBeLessThan(records.length);
  });

  it('skips seeding when organization already has sampleSeedVersion v1 (retry-safe)', async () => {
    const commit = vi.fn(() => Promise.resolve());
    vi.mocked(firestore.writeBatch).mockReturnValue({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit,
    } as any);
    vi.mocked(firestore.getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ sampleSeedVersion: SAMPLE_SEED_VERSION }),
    } as any);

    const first = await seedProfessionalData({
      organizationId: 'org_seeded',
      industry: 'SaaS',
      frameworks: ['soc2'],
    });
    const second = await seedProfessionalData({
      organizationId: 'org_seeded',
      industry: 'SaaS',
      frameworks: ['soc2'],
    });

    expect(first.skipped).toBe(true);
    expect(second.skipped).toBe(true);
    expect(commit).not.toHaveBeenCalled();
  });

  it('uses the same document ids on repeated buildSampleSeedRecords calls (no duplicate ids)', () => {
    const a = buildSampleSeedRecords({
      organizationId: 'org_dup',
      industry: 'SaaS',
      frameworks: ['iso27001'],
    });
    const b = buildSampleSeedRecords({
      organizationId: 'org_dup',
      industry: 'SaaS',
      frameworks: ['iso27001'],
    });
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
  });

  it('keeps sample records tenant-scoped (organizationId never cross-tenant)', () => {
    const orgA = buildSampleSeedRecords({
      organizationId: 'tenant_a',
      industry: 'SaaS',
      frameworks: [],
    });
    const orgB = buildSampleSeedRecords({
      organizationId: 'tenant_b',
      industry: 'SaaS',
      frameworks: [],
    });
    expect(orgA.every((r) => r.id.startsWith('tenant_a__'))).toBe(true);
    expect(orgB.every((r) => r.id.startsWith('tenant_b__'))).toBe(true);
    expect(orgA.map((r) => r.id)).not.toEqual(orgB.map((r) => r.id));
  });
});
