import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  queueVendorWelcomeWithDurableAudit,
  vendorWelcomeInviteId,
} from '../../server/lib/vendorWelcomeInvite';
import type { ResolvedNotificationIntent } from '../../server/lib/notificationIntent';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function fakeDb(seed: Record<string, Record<string, unknown>>) {
  const rows = new Map(Object.entries(seed));
  let commits = 0;

  function ref(collection: string, id: string) {
    return { id, key: `${collection}/${id}` };
  }

  const db: any = {
    collection(name: string) {
      return {
        doc(id: string) {
          return ref(name, id);
        },
      };
    },
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const writes: Array<() => void> = [];
      const tx = {
        async get(target: any) {
          const data = rows.get(target.key);
          return {
            exists: Boolean(data),
            data: () => (data ? { ...data } : undefined),
            id: target.id,
          };
        },
        create(target: any, data: Record<string, unknown>) {
          writes.push(() => {
            if (rows.has(target.key)) throw new Error(`already exists: ${target.key}`);
            rows.set(target.key, { ...data });
          });
        },
        set(target: any, patch: Record<string, unknown>, opts?: { merge?: boolean }) {
          writes.push(() => {
            const current = rows.get(target.key) || {};
            rows.set(target.key, opts?.merge ? { ...current, ...patch } : { ...patch });
          });
        },
      };
      const result = await fn(tx);
      writes.forEach((write) => write());
      commits += 1;
      return result;
    },
  };

  return { db, rows, commits: () => commits };
}

const resolved: ResolvedNotificationIntent = {
  intentType: 'vendor_welcome',
  objectId: 'vendor-1',
  organizationId: 'org-1',
  recipient: 'security@vendor.example',
  subject: "You've been added as a vendor in Guardentra",
  text: 'Hello',
  queueId: 'notify_vendor_welcome_vendor-1',
};

const queueDoc = {
  to: resolved.recipient,
  message: { subject: resolved.subject, text: resolved.text },
  notification: {
    intentType: 'vendor_welcome',
    objectId: 'vendor-1',
    organizationId: 'org-1',
  },
};

function seed(overrides: Record<string, Record<string, unknown>> = {}) {
  return {
    'users/user-1': { organizationId: 'org-1', role: 'admin', email: 'admin@customer.example' },
    'vendors/vendor-1': {
      organizationId: 'org-1',
      name: 'Vendor One',
      primaryContactEmail: 'Security@Vendor.example',
    },
    ...overrides,
  };
}

const auditRows = (rows: Map<string, Record<string, unknown>>) =>
  [...rows.entries()].filter(([key]) => key.startsWith('audit_material_intents/'));

const now = new Date('2026-10-26T12:00:00.000Z');

describe('#167 vendor welcome queue coupled to durable invite audit', () => {
  it('commits queue entry, deterministic invite record and audit intent together', async () => {
    const { db, rows } = fakeDb(seed());

    const result = await queueVendorWelcomeWithDurableAudit({
      db,
      actorId: 'user-1',
      resolved,
      queueDoc,
      now,
    });

    expect(result.deduplicated).toBe(false);
    expect(rows.get('mail/notify_vendor_welcome_vendor-1')).toEqual(queueDoc);
    expect(rows.get(`vendor_invites/${vendorWelcomeInviteId('vendor-1')}`)).toMatchObject({
      organizationId: 'org-1',
      vendorId: 'vendor-1',
      vendorName: 'Vendor One',
      vendorEmail: 'security@vendor.example',
      invitedBy: 'user-1',
      invitedByEmail: 'admin@customer.example',
      status: 'email_queued',
      queueId: 'notify_vendor_welcome_vendor-1',
      createdAt: now.toISOString(),
    });

    const audits = auditRows(rows);
    expect(audits).toHaveLength(1);
    const intent = audits[0][1] as any;
    expect(intent.state).toBe('pending');
    expect(intent.envelope).toMatchObject({
      tenantId: 'org-1',
      eventType: 'vendor.invite_queued',
      actorId: 'user-1',
      objectType: 'vendor',
      objectId: 'vendor-1',
      createdAt: now.toISOString(),
    });
    expect(intent.envelope.payload).toMatchObject({
      queueId: 'notify_vendor_welcome_vendor-1',
      queueAccepted: true,
      toDomain: 'vendor.example',
    });
    expect(rows.get(`vendor_invites/${vendorWelcomeInviteId('vendor-1')}`)?.auditEventId).toBe(
      intent.eventId,
    );
  });

  it('retry is idempotent: no second email, invite record or audit intent', async () => {
    const { db, rows } = fakeDb(seed());
    await queueVendorWelcomeWithDurableAudit({ db, actorId: 'user-1', resolved, queueDoc, now });
    const before = new Map(rows);

    const retry = await queueVendorWelcomeWithDurableAudit({
      db,
      actorId: 'user-1',
      resolved,
      queueDoc,
      now: new Date('2026-10-26T13:00:00.000Z'),
    });

    expect(retry.deduplicated).toBe(true);
    expect(rows).toEqual(before);
    expect([...rows.keys()].filter((key) => key.startsWith('mail/'))).toHaveLength(1);
    expect(auditRows(rows)).toHaveLength(1);
  });

  it('duplicate intent repairs a missing invite record and audit intent without a second email', async () => {
    const legacyQueue = { ...queueDoc, delivery: { state: 'SUCCESS' } };
    const { db, rows } = fakeDb(
      seed({ 'mail/notify_vendor_welcome_vendor-1': legacyQueue }),
    );

    const result = await queueVendorWelcomeWithDurableAudit({
      db,
      actorId: 'user-1',
      resolved,
      queueDoc,
      now,
    });

    expect(result.deduplicated).toBe(true);
    expect(rows.get('mail/notify_vendor_welcome_vendor-1')).toEqual(legacyQueue);
    expect(rows.get(`vendor_invites/${vendorWelcomeInviteId('vendor-1')}`)).toBeTruthy();
    expect(auditRows(rows)).toHaveLength(1);
  });

  it('keeps the original queued time when only the audit intent is repaired', async () => {
    const inviteId = `vendor_invites/${vendorWelcomeInviteId('vendor-1')}`;
    const { db, rows } = fakeDb(
      seed({
        'mail/notify_vendor_welcome_vendor-1': queueDoc,
        [inviteId]: { organizationId: 'org-1', createdAt: '2026-10-01T00:00:00.000Z' },
      }),
    );

    await queueVendorWelcomeWithDurableAudit({ db, actorId: 'user-1', resolved, queueDoc, now });

    expect(rows.get(inviteId)).toEqual({
      organizationId: 'org-1',
      createdAt: '2026-10-01T00:00:00.000Z',
    });
    const audits = auditRows(rows);
    expect(audits).toHaveLength(1);
    expect((audits[0][1] as any).envelope.createdAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('refuses a stale recipient and writes nothing', async () => {
    const { db, rows } = fakeDb(
      seed({
        'vendors/vendor-1': {
          organizationId: 'org-1',
          name: 'Vendor One',
          primaryContactEmail: 'someone-else@vendor.example',
        },
      }),
    );
    const before = new Map(rows);

    await expect(
      queueVendorWelcomeWithDurableAudit({ db, actorId: 'user-1', resolved, queueDoc, now }),
    ).rejects.toMatchObject({ status: 409, code: 'vendor_recipient_changed' });
    expect(rows).toEqual(before);
  });

  it('refuses a vendor that moved to another tenant and writes nothing', async () => {
    const { db, rows } = fakeDb(
      seed({
        'vendors/vendor-1': {
          organizationId: 'org-2',
          name: 'Vendor One',
          primaryContactEmail: 'security@vendor.example',
        },
      }),
    );
    const before = new Map(rows);

    await expect(
      queueVendorWelcomeWithDurableAudit({ db, actorId: 'user-1', resolved, queueDoc, now }),
    ).rejects.toMatchObject({ status: 404, code: 'object_unavailable' });
    expect(rows).toEqual(before);
  });

  it('refuses when the actor is no longer in the tenant and writes nothing', async () => {
    const { db, rows } = fakeDb(
      seed({ 'users/user-1': { organizationId: 'org-2', role: 'admin' } }),
    );
    const before = new Map(rows);

    await expect(
      queueVendorWelcomeWithDurableAudit({ db, actorId: 'user-1', resolved, queueDoc, now }),
    ).rejects.toMatchObject({ status: 403, code: 'membership_changed' });
    expect(rows).toEqual(before);
  });

  it('refuses a deleted vendor and writes nothing', async () => {
    const { db, rows } = fakeDb({
      'users/user-1': { organizationId: 'org-1', role: 'admin' },
    });

    await expect(
      queueVendorWelcomeWithDurableAudit({ db, actorId: 'user-1', resolved, queueDoc, now }),
    ).rejects.toMatchObject({ status: 404, code: 'vendor_missing' });
    expect([...rows.keys()]).toEqual(['users/user-1']);
  });

  it('routes vendor_welcome through the durable server transaction', () => {
    const route = read('server/routes/notify.ts');
    expect(route).toContain("resolved.intentType === 'vendor_welcome'");
    expect(route).toContain('queueVendorWelcomeWithDurableAudit({');
  });

  it('browser no longer writes vendor_invites or emits vendor.invite_queued', () => {
    const page = read('src/pages/VendorsDirectory.tsx');
    expect(page).not.toContain("addDoc(collection(db, 'vendor_invites')");
    expect(page).not.toContain("'vendor.invite_queued'");
    expect(page).toContain("intentType: 'vendor_welcome'");
    expect(page).toContain('Queue success is not delivery proof.');
  });

  it('Firestore rules deny client creation of vendor_invites', () => {
    const rules = read('firestore.rules');
    const block = rules.slice(
      rules.indexOf('match /vendor_invites/{inviteId}'),
      rules.indexOf('match /vendor_triage/{vendorId}'),
    );
    expect(block).toContain('allow create: if false;');
    expect(block).not.toContain('isCreatingForOwnOrg()');
  });
});
