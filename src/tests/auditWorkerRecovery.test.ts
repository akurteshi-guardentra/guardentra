import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('../../server/lib/audit/pool.ts', () => ({
  getAuditPool: () => ({ query: h.query, connect: h.connect }),
  isAuditSpineEnabled: () => true,
}));

vi.mock('../../server/lib/audit/hashChain.ts', () => ({
  persistOutboxPayload: vi.fn(),
}));

import {
  processAuditOutboxBatch,
  reclaimStaleAuditOutbox,
} from '../../server/lib/audit/worker';

describe('#74 audit outbox stale lease recovery', () => {
  beforeEach(() => {
    h.query.mockReset();
    h.connect.mockReset();
    vi.stubEnv('AUDIT_OUTBOX_LEASE_SECONDS', '45');
    vi.stubEnv('AUDIT_OUTBOX_MAX_ATTEMPTS', '8');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reclaims stale processing rows with a bounded lease and attempt budget', async () => {
    h.query.mockResolvedValueOnce({ rowCount: 2 });
    await expect(reclaimStaleAuditOutbox()).resolves.toBe(2);
    const [sql, args] = h.query.mock.calls[0];
    expect(sql).toContain("WHERE status = 'processing'");
    expect(sql).toContain('attempts + 1');
    expect(sql).toContain('stale processing lease reclaimed');
    expect(args).toEqual(['45', 8]);
  });

  it('runs stale recovery before claiming pending rows', async () => {
    h.query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] });

    await expect(processAuditOutboxBatch(5)).resolves.toBe(0);
    expect(h.query).toHaveBeenCalledTimes(2);
    expect(String(h.query.mock.calls[0][0])).toContain("status = 'processing'");
    expect(String(h.query.mock.calls[1][0])).toContain("status = 'pending'");
    expect(h.query.mock.calls[1][1]).toEqual([5]);
  });
});
