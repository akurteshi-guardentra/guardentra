import { describe, expect, it, vi } from 'vitest';
import { persistOutboxPayload } from '../../server/lib/audit/hashChain';

describe('#74 audit hash-chain exactly-once locking', () => {
  it('takes the tenant transaction lock before checking duplicate event_id', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ tenant_id: 'org-1' }] });
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
    expect(String(query.mock.calls[1][0])).toContain('SELECT tenant_id FROM audit_events');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rejects a duplicate event id that belongs to another tenant', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ tenant_id: 'org-other' }] });
    const client = { query } as any;

    await expect(
      persistOutboxPayload(client, {
        eventId: '00000000-0000-4000-8000-000000000074',
        tenantId: 'org-1',
        eventType: 'vendor.created',
        payload: {},
      }),
    ).rejects.toThrow('audit event identity conflict');
    expect(query).toHaveBeenCalledTimes(2);
  });
});
