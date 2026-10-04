import { describe, expect, it } from 'vitest';
import {
  NotificationIntentError,
  parseNotificationIntentRequest,
  resolveNotificationIntent,
  resolvePublicAppUrl,
  type NotificationAuthorityStore,
} from '../../server/lib/notificationIntent';

function store(overrides: Partial<NotificationAuthorityStore> = {}): NotificationAuthorityStore {
  return {
    getUser: async () => ({ organizationId: 'org-a', role: 'admin' }),
    getVendor: async () => ({
      organizationId: 'org-a',
      name: 'Vendor One',
      primaryContactEmail: 'vendor@example.com',
      primaryContactName: 'Vera',
    }),
    getAssessment: async () => ({
      organizationId: 'org-a',
      vendorId: 'vendor-1',
      vendorName: 'Untrusted snapshot name',
      frameworkName: 'GuardEntra assessment pack',
      inviteEmail: 'attacker@example.net',
      dueAt: '2026-10-20T00:00:00.000Z',
      status: 'Pending',
    }),
    getOrganization: async () => ({ name: 'Customer Co' }),
    ...overrides,
  };
}

async function expectIntentError(
  promise: Promise<unknown> | (() => unknown),
  status: number,
  code: string
) {
  try {
    if (typeof promise === 'function') {
      promise();
    } else {
      await promise;
    }
    throw new Error('expected NotificationIntentError');
  } catch (err) {
    expect(err).toBeInstanceOf(NotificationIntentError);
    expect((err as NotificationIntentError).status).toBe(status);
    expect((err as NotificationIntentError).code).toBe(code);
  }
}

describe('#86 tenant-authorized notification intents', () => {
  it('rejects the old arbitrary-recipient/body shape', async () => {
    await expectIntentError(
      () =>
        parseNotificationIntentRequest({
          intentType: 'vendor_welcome',
          objectId: 'vendor-1',
          to: 'attacker@example.net',
          subject: 'arbitrary',
          text: 'relay me',
        }),
      400,
      'invalid_intent_shape'
    );
  });

  it('derives vendor welcome recipient and content from same-tenant authoritative state', async () => {
    const resolved = await resolveNotificationIntent({
      uid: 'user-1',
      intent: { intentType: 'vendor_welcome', objectId: 'vendor-1' },
      store: store(),
      now: new Date('2026-10-04T00:00:00.000Z'),
    });

    expect(resolved.recipient).toBe('vendor@example.com');
    expect(resolved.organizationId).toBe('org-a');
    expect(resolved.text).toContain('Customer Co');
    expect(resolved.text).toContain('Vendor One');
    expect(resolved.queueId).toBe('notify_vendor_welcome_vendor-1');
  });

  it('refuses cross-tenant vendor intent', async () => {
    await expectIntentError(
      resolveNotificationIntent({
        uid: 'user-1',
        intent: { intentType: 'vendor_welcome', objectId: 'vendor-1' },
        store: store({
          getVendor: async () => ({
            organizationId: 'org-b',
            primaryContactEmail: 'victim@example.com',
          }),
        }),
      }),
      403,
      'tenant_mismatch'
    );
  });

  it('refuses missing/deleted authoritative object', async () => {
    await expectIntentError(
      resolveNotificationIntent({
        uid: 'user-1',
        intent: { intentType: 'assessment_invite', objectId: 'assessment-1' },
        store: store({ getAssessment: async () => null }),
        publicAppUrl: 'https://app.guardentra.test',
      }),
      404,
      'assessment_missing'
    );
  });

  it('refuses missing/unknown role even when uid and object exist', async () => {
    await expectIntentError(
      resolveNotificationIntent({
        uid: 'user-1',
        intent: { intentType: 'vendor_welcome', objectId: 'vendor-1' },
        store: store({ getUser: async () => ({ organizationId: 'org-a', role: 'viewer' }) }),
      }),
      403,
      'role_not_authorized'
    );
  });

  it('assessment invite ignores assessment.inviteEmail and derives vendor contact', async () => {
    const resolved = await resolveNotificationIntent({
      uid: 'user-1',
      intent: { intentType: 'assessment_invite', objectId: 'assessment-1' },
      store: store(),
      publicAppUrl: 'https://app.guardentra.test',
      now: new Date('2026-10-04T00:00:00.000Z'),
    });

    expect(resolved.recipient).toBe('vendor@example.com');
    expect(resolved.recipient).not.toBe('attacker@example.net');
    expect(resolved.text).toContain('https://app.guardentra.test/portal/assessment-1');
    expect(resolved.queueId).toBe('notify_assessment_invite_assessment-1');
  });

  it('assessment requires vendor and assessment to share actor tenant', async () => {
    await expectIntentError(
      resolveNotificationIntent({
        uid: 'user-1',
        intent: { intentType: 'assessment_invite', objectId: 'assessment-1' },
        store: store({
          getVendor: async () => ({
            organizationId: 'org-b',
            primaryContactEmail: 'victim@example.com',
          }),
        }),
        publicAppUrl: 'https://app.guardentra.test',
      }),
      403,
      'tenant_mismatch'
    );
  });

  it('same-day reminder retries deduplicate while later-day reminder gets a new id', async () => {
    const first = await resolveNotificationIntent({
      uid: 'user-1',
      intent: { intentType: 'assessment_reminder', objectId: 'assessment-1' },
      store: store(),
      publicAppUrl: 'https://app.guardentra.test',
      now: new Date('2026-10-04T01:00:00.000Z'),
    });
    const retry = await resolveNotificationIntent({
      uid: 'user-1',
      intent: { intentType: 'assessment_reminder', objectId: 'assessment-1' },
      store: store(),
      publicAppUrl: 'https://app.guardentra.test',
      now: new Date('2026-10-04T20:00:00.000Z'),
    });
    const nextDay = await resolveNotificationIntent({
      uid: 'user-1',
      intent: { intentType: 'assessment_reminder', objectId: 'assessment-1' },
      store: store(),
      publicAppUrl: 'https://app.guardentra.test',
      now: new Date('2026-10-05T01:00:00.000Z'),
    });

    expect(retry.queueId).toBe(first.queueId);
    expect(nextDay.queueId).not.toBe(first.queueId);
  });

  it('refuses reminder for completed assessment', async () => {
    await expectIntentError(
      resolveNotificationIntent({
        uid: 'user-1',
        intent: { intentType: 'assessment_reminder', objectId: 'assessment-1' },
        store: store({
          getAssessment: async () => ({
            organizationId: 'org-a',
            vendorId: 'vendor-1',
            status: 'Completed',
          }),
        }),
        publicAppUrl: 'https://app.guardentra.test',
      }),
      409,
      'assessment_complete'
    );
  });

  it('requires canonical https public URL in production-like mode', async () => {
    expect(resolvePublicAppUrl('https://guardentra.example/path', true)).toBe(
      'https://guardentra.example'
    );
    await expectIntentError(
      () => resolvePublicAppUrl('http://guardentra.example', true),
      503,
      'public_app_url_insecure'
    );
    expect(resolvePublicAppUrl(undefined, false)).toBe('http://localhost:8080');
  });
});
