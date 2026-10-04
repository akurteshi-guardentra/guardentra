import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
}));

vi.mock('../../server/lib/adminDb.ts', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = h.docs.get(`${name}/${id}`);
          return { exists: Boolean(data), data: () => data };
        },
      }),
    }),
  }),
}));

import {
  AuditAuthorizationError,
  authorizeAuditEmit,
  authorizeAuditTenantRead,
} from '../../server/lib/audit/authorization';

function put(path: string, data: Record<string, unknown>) {
  h.docs.set(path, data);
}

describe('#74 audit tenant/principal authorization', () => {
  beforeEach(() => {
    h.docs.clear();
    put('users/u1', { organizationId: 'org-1', role: 'admin' });
    put('users/u2', { organizationId: 'org-2', role: 'member' });
    put('vendors/v1', { organizationId: 'org-1' });
    put('vendors/v2', { organizationId: 'org-2' });
    put('assessments/a1', { organizationId: 'org-1' });
    put('assessments/a2', { organizationId: 'org-2' });
  });

  it('derives org-user actor identity from the verified principal and ignores forged actor metadata', async () => {
    const actor = await authorizeAuditEmit(
      { uid: 'u1' },
      {
        tenantId: 'org-1',
        eventType: 'vendor.created',
        actorId: 'forged-user',
        actorType: 'system',
        objectType: 'vendor',
        objectId: 'v1',
      },
    );
    expect(actor).toMatchObject({
      actorId: 'u1',
      actorType: 'user',
      tenantId: 'org-1',
      role: 'admin',
    });
  });

  it('rejects a signed-in user selecting another tenant', async () => {
    await expect(authorizeAuditTenantRead({ uid: 'u1' }, 'org-2')).rejects.toMatchObject({
      status: 403,
      code: 'audit_tenant_forbidden',
    });
  });

  it('rejects a cross-tenant object even when tenantId itself matches the user', async () => {
    await expect(
      authorizeAuditEmit(
        { uid: 'u1' },
        {
          tenantId: 'org-1',
          eventType: 'vendor.created',
          objectType: 'vendor',
          objectId: 'v2',
        },
      ),
    ).rejects.toMatchObject({ status: 403, code: 'audit_object_forbidden' });
  });

  it('allows scoped portal events only for the claimed assessment and derives portal actor semantics', async () => {
    const actor = await authorizeAuditEmit(
      { uid: 'portal_a1', portalAssessmentId: 'a1' },
      {
        tenantId: 'org-1',
        eventType: 'assessment.submitted',
        actorId: 'forged',
        actorType: 'user',
        objectType: 'assessment',
        objectId: 'a1',
      },
    );
    expect(actor).toEqual({ actorId: 'portal_a1', actorType: 'portal', tenantId: 'org-1' });
  });

  it('portal session cannot forge org-side event types or another assessment', async () => {
    await expect(
      authorizeAuditEmit(
        { uid: 'portal_a1', portalAssessmentId: 'a1' },
        {
          tenantId: 'org-1',
          eventType: 'decision.finalized',
          objectType: 'assessment',
          objectId: 'a1',
        },
      ),
    ).rejects.toMatchObject({ status: 403, code: 'portal_audit_event_forbidden' });

    await expect(
      authorizeAuditEmit(
        { uid: 'portal_a1', portalAssessmentId: 'a1' },
        {
          tenantId: 'org-2',
          eventType: 'answer.saved',
          objectType: 'assessment',
          objectId: 'a2',
        },
      ),
    ).rejects.toBeInstanceOf(AuditAuthorizationError);
  });

  it('portal session cannot verify or export an organization audit trail', async () => {
    await expect(
      authorizeAuditTenantRead({ uid: 'portal_a1', portalAssessmentId: 'a1' }, 'org-1'),
    ).rejects.toMatchObject({ status: 403, code: 'portal_audit_read_forbidden' });
  });
});
