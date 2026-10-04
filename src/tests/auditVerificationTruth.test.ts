import { describe, expect, it } from 'vitest';
import { auditVerifyHttpStatus } from '../../server/lib/audit/verify';

describe('#74 audit verification HTTP truth', () => {
  it('uses 200 only for a verified chain', () => {
    expect(
      auditVerifyHttpStatus({
        ok: true,
        tenantId: 'org-1',
        checked: 2,
        message: 'Verified 2 link(s)',
      }),
    ).toBe(200);
  });

  it('uses conflict status for a cryptographically broken chain', () => {
    expect(
      auditVerifyHttpStatus({
        ok: false,
        tenantId: 'org-1',
        checked: 2,
        firstBreakSeq: 2,
        message: 'hash mismatch at seq 2',
      }),
    ).toBe(409);
  });

  it('uses upstream failure status when the audit database is unavailable', () => {
    expect(
      auditVerifyHttpStatus({
        ok: false,
        tenantId: 'org-1',
        checked: 0,
        message: 'Audit database unavailable',
      }),
    ).toBe(502);
  });
});
