// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIT_EVENT_DNS_NAMESPACE,
  MATERIAL_EVENT_ID_MAPPING_VERSION,
  MATERIAL_EVENT_ID_NAMESPACE,
  assertOutboxProvenance,
  outboxRetryMatches,
  resolveAuditEventIdentity,
  uuidV5,
} from '../../server/lib/audit/eventIdentity';
import { emitAuditIntent } from '../../server/lib/audit/emitIntent';
import { materialAuditEventId } from '../../server/lib/audit/materialIntent';
import { closeAuditPool, getAuditPool } from '../../server/lib/audit/pool';

const LOCKED_MATERIAL_ID =
  'mat_a117add82b0d02e26e842f19e143b2b0b30a47e23071f6ce87f31b9faa01582b';
const LOCKED_SQL_ID = 'e949d3fc-46e8-5abf-b322-560ff63d9995';

describe('#201 material event identity mapping', () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    await closeAuditPool();
  });

  it('keeps the Firestore journal id and maps the full value to a stable UUID', () => {
    const eventId = materialAuditEventId(['org-1', 'decision.finalized', 'asm-1']);
    expect(eventId).toBe(LOCKED_MATERIAL_ID);
    expect(uuidV5('audit.guardentra.com', AUDIT_EVENT_DNS_NAMESPACE)).toBe(
      MATERIAL_EVENT_ID_NAMESPACE,
    );

    const first = resolveAuditEventIdentity(eventId);
    const second = resolveAuditEventIdentity(eventId);
    expect(first).toEqual(second);
    expect(first.sqlEventId).toBe(LOCKED_SQL_ID);
    expect(first.sourceEventId).toBe(eventId);
    expect(first.mapping).toEqual({
      version: MATERIAL_EVENT_ID_MAPPING_VERSION,
      algorithm: 'uuid-v5',
      namespace: MATERIAL_EVENT_ID_NAMESPACE,
    });
    expect(first.sqlEventId).not.toContain('mat_');
    expect(eventId.startsWith('mat_')).toBe(true);
    expect(eventId.slice(4)).toHaveLength(64);
  });

  it('does not derive a new UUID when the SQL id is resolved again', () => {
    const mapped = resolveAuditEventIdentity(LOCKED_MATERIAL_ID);
    const again = resolveAuditEventIdentity(mapped.sqlEventId);
    expect(again.sqlEventId).toBe(mapped.sqlEventId);
    expect(again.sourceEventId).toBe(mapped.sqlEventId);
    expect(again.mapping).toBeNull();
  });

  it('canonicalizes an existing UUID without changing its identity', () => {
    const resolved = resolveAuditEventIdentity('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11');
    expect(resolved).toEqual({
      sqlEventId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sourceEventId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      mapping: null,
    });
    expect(resolveAuditEventIdentity('00000000-0000-4000-8000-000000000074').sqlEventId).toBe(
      '00000000-0000-4000-8000-000000000074',
    );
  });

  it('rejects malformed ids before they can be stored', () => {
    const malformed = [
      'mat_short',
      `mat_${'A'.repeat(64)}`,
      `mat_${'g'.repeat(64)}`,
      'not-a-uuid',
      "'; DROP TABLE audit_events; --",
      `${'a'.repeat(32)}`,
      `{${LOCKED_SQL_ID}}`,
    ];
    for (const eventId of malformed) {
      expect(() => resolveAuditEventIdentity(eventId)).toThrow('unsupported audit event id');
    }
  });

  it('accepts an unmapped pre-PR UUID envelope and rejects partial mapping metadata', () => {
    const legacy = {
      eventId: 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
      tenantId: 'org-1',
      eventType: 'vendor.created',
      objectType: 'vendor',
      objectId: 'v1',
      payload: { note: 'pre-pr' },
    };
    const incoming = {
      tenantId: 'org-1',
      eventId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sourceEventId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      eventType: 'vendor.created',
      objectType: 'vendor',
      objectId: 'v1',
      eventIdMapping: null,
    };
    expect(outboxRetryMatches(legacy, 'org-1', incoming)).toBe(true);
    expect(outboxRetryMatches(legacy, 'org-1', { ...incoming, eventType: 'vendor.imported' })).toBe(false);
    expect(
      outboxRetryMatches(
        { ...legacy, sourceEventId: LOCKED_MATERIAL_ID },
        'org-1',
        incoming,
      ),
    ).toBe(false);
    expect(() =>
      assertOutboxProvenance({
        event_id: incoming.eventId,
        tenant_id: 'org-other',
        payload: { ...legacy, eventId: incoming.eventId },
      }),
    ).toThrow('audit event identity conflict');
  });

  it('does not open a pool while the spine is disabled', async () => {
    vi.stubEnv('AUDIT_SPINE_ENABLED', 'false');
    vi.stubEnv('AUDIT_DATABASE_URL', 'postgres://127.0.0.1:1/refuse-disabled-spine');
    const result = await emitAuditIntent({
      eventId: LOCKED_MATERIAL_ID,
      tenantId: 'org-1',
      eventType: 'decision.finalized',
      payload: { token: 'must-not-be-read-for-a-connection' },
    });
    expect(result).toEqual({
      queued: false,
      skipped: true,
      reason: 'AUDIT_SPINE_ENABLED=false',
    });
    expect(getAuditPool()).toBeNull();
  });
});
