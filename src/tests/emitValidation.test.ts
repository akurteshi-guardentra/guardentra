import { describe, expect, it } from 'vitest';
import { parseAuditEmitBody } from '../../server/lib/audit/emitValidation';

describe('parseAuditEmitBody', () => {
  it('accepts a minimal valid emit', () => {
    const parsed = parseAuditEmitBody({
      tenantId: 'org_1',
      eventType: 'vendor.created',
      payload: { name: 'Acme' },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.tenantId).toBe('org_1');
      expect(parsed.value.eventType).toBe('vendor.created');
    }
  });

  it('rejects unexpected fields', () => {
    const parsed = parseAuditEmitBody({
      tenantId: 'org_1',
      eventType: 'vendor.created',
      evil: true,
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects unknown event types', () => {
    const parsed = parseAuditEmitBody({
      tenantId: 'org_1',
      eventType: 'not.a.real.event',
    });
    expect(parsed.ok).toBe(false);
  });
});
