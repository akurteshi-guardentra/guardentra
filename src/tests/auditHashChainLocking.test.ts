import { describe, expect, it, vi } from 'vitest';
import { persistOutboxPayload } from '../../server/lib/audit/hashChain';

describe('#74 audit hash-chain exactly-once locking', () => {
  it('takes the tenant transaction lock before checking duplicate event_id', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    const client = { query } as any;

    await persistOutboxPayload(client, {
      eventId: 'event-1',
      tenantId: 'org-1',
      eventType: 'vendor.created',
      actorId: 'u1',
      actorType: 'user',
      objectType: 'vendor',
      objectId: 'v1',
      payload: {},
    });

    expect(String(query.mock.calls[0][0])).toContain('pg_advisory_xact_lock');
    expect(String(query.mock.calls[1][0])).toContain('SELECT 1 FROM audit_events');
    expect(query).toHaveBeenCalledTimes(2);
  });
});
