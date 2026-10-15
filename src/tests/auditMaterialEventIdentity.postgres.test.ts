// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { AuditEventIdentityError, resolveAuditEventIdentity } from '../../server/lib/audit/eventIdentity';
import { emitAuditIntent, type EmitResult, type StoredAuditEnvelope } from '../../server/lib/audit/emitIntent';
import { persistOutboxPayload } from '../../server/lib/audit/hashChain';
import { materialAuditEventId } from '../../server/lib/audit/materialIntent';
import { closeAuditPool, getAuditPool } from '../../server/lib/audit/pool';
import type { AuditEmitEnvelope } from '../../server/lib/audit/types';
import { verifyTenantChain } from '../../server/lib/audit/verify';
import { processAuditOutboxBatch } from '../../server/lib/audit/worker';

const FIXTURE = {
  host: '127.0.0.1',
  port: 5432,
  database: 'guardentra_audit_material_ci',
  user: 'postgres',
};
const APP_USER = 'ci_audit_login';

if (process.env.AUDIT_PG_INTEGRATION !== '1') {
  throw new Error('audit material PostgreSQL test requires AUDIT_PG_INTEGRATION=1');
}
if (
  process.env.PGHOST !== FIXTURE.host ||
  process.env.PGPORT !== String(FIXTURE.port) ||
  process.env.PGDATABASE !== FIXTURE.database ||
  process.env.PGUSER !== FIXTURE.user
) {
  throw new Error('Refusing material-id test outside the disposable PostgreSQL 16 fixture');
}
for (const key of ['PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGHOSTADDR', 'PGPASSWORD']) {
  if (process.env[key]) throw new Error('Unexpected fixture override');
}

function adminClient(): pg.Client {
  return new pg.Client({
    host: FIXTURE.host,
    port: FIXTURE.port,
    database: FIXTURE.database,
    user: FIXTURE.user,
    connectionTimeoutMillis: 10000,
  });
}

function appClient(): pg.Client {
  return new pg.Client({
    host: FIXTURE.host,
    port: FIXTURE.port,
    database: FIXTURE.database,
    user: APP_USER,
    connectionTimeoutMillis: 10000,
  });
}

function migrationSql(name: string): string {
  return readFileSync(resolve(process.cwd(), 'migrations/audit', name), 'utf8');
}

async function applyMigrations(admin: pg.Client): Promise<void> {
  await admin.query('DROP SCHEMA IF EXISTS public CASCADE');
  await admin.query('CREATE SCHEMA public AUTHORIZATION postgres');
  await admin.query(migrationSql('001_init.sql'));
  await admin.query(migrationSql('002_roles.sql'));
  await admin.query(migrationSql('003_harden_audit_app_nologin.sql'));
  await admin.query(`
    DROP ROLE IF EXISTS ${APP_USER};
    CREATE ROLE ${APP_USER} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE;
    GRANT audit_app TO ${APP_USER};
  `);
}

function queuedEvent(result: EmitResult): { eventId: string; sourceEventId: string } {
  if (!('eventId' in result) || result.queued !== true) {
    throw new Error('expected a newly queued audit event');
  }
  return result;
}

type Counted = {
  events: Array<{ event_id: string; payload: Record<string, unknown> }>;
  chain: Array<{ event_id: string }>;
  outbox: Array<{ event_id: string; status: string; payload: StoredAuditEnvelope }>;
};

async function counts(tenantId: string): Promise<Counted> {
  const db = getAuditPool();
  if (!db) throw new Error('Audit database unavailable');
  const [events, chain, outbox] = await Promise.all([
    db.query(
      `SELECT event_id::text, payload FROM audit_events WHERE tenant_id = $1 ORDER BY created_at`,
      [tenantId],
    ),
    db.query(
      `SELECT event_id::text FROM audit_hash_chain WHERE tenant_id = $1 ORDER BY seq`,
      [tenantId],
    ),
    db.query(
      `SELECT event_id::text, status, payload FROM audit_outbox WHERE tenant_id = $1 ORDER BY id`,
      [tenantId],
    ),
  ]);
  return { events: events.rows, chain: chain.rows, outbox: outbox.rows };
}

describe('#201 material event identity on PostgreSQL 16', () => {
  beforeAll(async () => {
    const admin = adminClient();
    await admin.connect();
    try {
      const version = await admin.query('SHOW server_version_num');
      const serverVersion = Number(version.rows[0].server_version_num);
      if (serverVersion < 160000 || serverVersion >= 170000) {
        throw new Error('Material event identity acceptance requires PostgreSQL 16');
      }
      await applyMigrations(admin);
    } finally {
      await admin.end();
    }
    process.env.AUDIT_SPINE_ENABLED = 'true';
    process.env.AUDIT_DATABASE_URL = `postgres://${APP_USER}@${FIXTURE.host}:${FIXTURE.port}/${FIXTURE.database}`;
    await closeAuditPool();
  }, 30000);

  afterAll(async () => {
    delete process.env.AUDIT_SPINE_ENABLED;
    delete process.env.AUDIT_DATABASE_URL;
    await closeAuditPool();
  });

  it('rejects a raw mat_ id on the UUID column before the corrected insert', async () => {
    const sourceEventId = materialAuditEventId(['org-baseline', 'vendor.created', 'vendor-baseline']);
    const db = getAuditPool();
    if (!db) throw new Error('Audit database unavailable');
    await expect(
      db.query(
        `INSERT INTO audit_outbox (event_id, tenant_id, payload) VALUES ($1, $2, '{}'::jsonb)`,
        [sourceEventId, 'org-baseline'],
      ),
    ).rejects.toMatchObject({ code: '22P02' });
    expect((await counts('org-baseline')).outbox).toHaveLength(0);
  });

  it('persists one material event, deduplicates a lost acknowledgement, and verifies the chain', async () => {
    const sourceEventId = materialAuditEventId([
      'org-retry',
      'assessment.submitted',
      'asm-retry',
    ]);
    const input: AuditEmitEnvelope = {
      eventId: sourceEventId,
      tenantId: 'org-retry',
      eventType: 'assessment.submitted',
      actorId: 'portal-user',
      actorType: 'portal',
      objectType: 'assessment',
      objectId: 'asm-retry',
      payload: { token: 'portal-secret', outcome: 'submitted' },
    };

    const queued = queuedEvent(await emitAuditIntent(input));
    expect(queued.sourceEventId).toBe(sourceEventId);
    expect(queued.eventId).toBe(resolveAuditEventIdentity(sourceEventId).sqlEventId);
    expect(queued.eventId).not.toBe(sourceEventId);

    const lostAck = await emitAuditIntent(input);
    expect(lostAck).toEqual({
      queued: false,
      eventId: queued.eventId,
      sourceEventId,
      duplicate: true,
    });

    expect(await processAuditOutboxBatch(20)).toBe(1);
    expect(await processAuditOutboxBatch(20)).toBe(0);

    const afterAck = await emitAuditIntent(input);
    expect(afterAck).toMatchObject({ duplicate: true, eventId: queued.eventId, sourceEventId });

    const rows = await counts('org-retry');
    expect(rows.outbox).toHaveLength(1);
    expect(rows.events).toHaveLength(1);
    expect(rows.chain).toHaveLength(1);
    expect(rows.outbox[0].event_id).toBe(queued.eventId);
    expect(rows.outbox[0].status).toBe('acked');
    expect(rows.outbox[0].payload.eventId).toBe(queued.eventId);
    expect(rows.outbox[0].payload.sourceEventId).toBe(sourceEventId);
    expect(rows.events[0].event_id).toBe(queued.eventId);
    expect(rows.chain[0].event_id).toBe(queued.eventId);
    expect(rows.events[0].payload).toMatchObject({
      outcome: 'submitted',
      token: '[redacted]',
      auditIdentity: {
        mappingVersion: 'mat-uuid-v1',
        sourceEventId,
        sqlEventId: queued.eventId,
      },
    });
    expect(JSON.stringify(rows)).not.toContain('portal-secret');

    const pool = getAuditPool();
    if (!pool) throw new Error('Audit database unavailable');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await persistOutboxPayload(client, rows.outbox[0].payload);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    expect((await counts('org-retry')).chain).toHaveLength(1);

    const verified = await verifyTenantChain('org-retry');
    expect(verified.ok).toBe(true);
    expect(verified.checked).toBe(1);
  });

  it('accepts an existing UUID without adding material mapping metadata', async () => {
    const eventId = '00000000-0000-4000-8000-000000000074';
    const queued = await emitAuditIntent({
      eventId,
      tenantId: 'org-uuid',
      eventType: 'assessment.created',
      objectType: 'assessment',
      objectId: 'asm-uuid',
      payload: { note: 'existing-uuid' },
    });
    expect(queued).toEqual({ queued: true, eventId, sourceEventId: eventId });
    const replay = await emitAuditIntent({
      eventId,
      tenantId: 'org-uuid',
      eventType: 'assessment.created',
      objectType: 'assessment',
      objectId: 'asm-uuid',
      payload: { note: 'existing-uuid' },
    });
    expect(replay).toEqual({ queued: false, eventId, sourceEventId: eventId, duplicate: true });
    expect(await processAuditOutboxBatch(20)).toBe(1);
    const rows = await counts('org-uuid');
    expect(rows.events).toHaveLength(1);
    expect(rows.events[0].event_id).toBe(eventId);
    expect(rows.events[0].payload).toEqual({ note: 'existing-uuid' });
    expect(rows.chain).toHaveLength(1);
    const verified = await verifyTenantChain('org-uuid');
    expect(verified.ok).toBe(true);
    expect(verified.checked).toBe(1);
  });

  it('canonicalizes an uppercase UUID so verification matches the stored row', async () => {
    const queued = queuedEvent(
      await emitAuditIntent({
        eventId: 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
        tenantId: 'org-uuid-case',
        eventType: 'vendor.imported',
        objectType: 'vendor',
        objectId: 'vendor-case',
      }),
    );
    expect(queued.eventId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(await processAuditOutboxBatch(20)).toBe(1);
    const verified = await verifyTenantChain('org-uuid-case');
    expect(verified.ok).toBe(true);
    expect(verified.checked).toBe(1);
  });

  it('generates a fresh UUID when the caller omits the event id', async () => {
    const input: AuditEmitEnvelope = {
      tenantId: 'org-generated',
      eventType: 'report.exported',
      objectType: 'organization',
      objectId: 'org-generated',
    };
    const first = await emitAuditIntent(input);
    const second = await emitAuditIntent(input);
    if (!('eventId' in first) || !('eventId' in second)) throw new Error('expected SQL event ids');
    expect(first.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(first.sourceEventId).toBe(first.eventId);
    expect(second.eventId).not.toBe(first.eventId);
    expect(await processAuditOutboxBatch(20)).toBe(2);
    const verified = await verifyTenantChain('org-generated');
    expect(verified).toMatchObject({ ok: true, checked: 2 });
  });

  it('rejects malformed ids, conflicting tenants, and conflicting source identities', async () => {
    const db = getAuditPool();
    if (!db) throw new Error('Audit database unavailable');
    const malformed = [
      'mat_short',
      `mat_${'A'.repeat(64)}`,
      "'; DROP TABLE audit_events; --",
    ];
    for (const eventId of malformed) {
      await expect(
        emitAuditIntent({
          eventId,
          tenantId: 'org-bad',
          eventType: 'vendor.created',
        }),
      ).rejects.toThrow('unsupported audit event id');
    }
    expect((await counts('org-bad')).outbox).toHaveLength(0);

    const sourceEventId = materialAuditEventId(['org-conflict', 'vendor.created', 'vendor-conflict']);
    const original: AuditEmitEnvelope = {
      eventId: sourceEventId,
      tenantId: 'org-conflict',
      eventType: 'vendor.created',
      objectType: 'vendor',
      objectId: 'vendor-conflict',
      payload: { auditIdentity: { sourceEventId: 'mat_forged', sqlEventId: 'forged' }, name: 'Vendor' },
    };
    const queued = queuedEvent(await emitAuditIntent(original));
    await expect(
      emitAuditIntent({ ...original, tenantId: 'org-conflict-other' }),
    ).rejects.toBeInstanceOf(AuditEventIdentityError);
    await expect(
      emitAuditIntent({ ...original, eventType: 'vendor.imported' }),
    ).rejects.toThrow('audit event identity conflict');

    const mapped = resolveAuditEventIdentity(sourceEventId);
    const otherSource = materialAuditEventId(['org-conflict', 'vendor.created', 'other-vendor']);
    await db.query(
      `INSERT INTO audit_outbox (event_id, tenant_id, payload, status)
       VALUES ($1, $2, $3::jsonb, 'dead')`,
      [
        resolveAuditEventIdentity(otherSource).sqlEventId,
        'org-conflict',
        JSON.stringify({
          eventId: resolveAuditEventIdentity(otherSource).sqlEventId,
          sourceEventId: sourceEventId,
          eventIdMapping: mapped.mapping,
          tenantId: 'org-conflict',
          eventType: 'vendor.created',
          actorId: null,
          actorType: 'user',
          objectType: 'vendor',
          objectId: 'vendor-conflict',
          payload: {
            auditIdentity: {
              mappingVersion: 'mat-uuid-v1',
              sourceEventId,
              sqlEventId: mapped.sqlEventId,
            },
          },
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
        }),
      ],
    );
    await expect(
      emitAuditIntent({ ...original, eventId: otherSource }),
    ).rejects.toThrow('audit event identity conflict');

    expect(await processAuditOutboxBatch(20)).toBe(1);
    const rows = await counts('org-conflict');
    expect(rows.events).toHaveLength(1);
    expect(rows.events[0].payload).toMatchObject({
      name: 'Vendor',
      auditIdentity: {
        sourceEventId,
        sqlEventId: queued.eventId,
      },
    });
    expect(rows.events[0].payload.auditIdentity).not.toMatchObject({ sourceEventId: 'mat_forged' });
    expect((await counts('org-conflict-other')).outbox).toHaveLength(0);
  });

  it('keeps tenant chains separate and detects tampering', async () => {
    const first = materialAuditEventId(['org-chain-a', 'decision.finalized', 'asm-a']);
    const second = materialAuditEventId(['org-chain-b', 'decision.finalized', 'asm-b']);
    await emitAuditIntent({
      eventId: first,
      tenantId: 'org-chain-a',
      eventType: 'decision.finalized',
      objectType: 'assessment',
      objectId: 'asm-a',
    });
    await emitAuditIntent({
      eventId: second,
      tenantId: 'org-chain-b',
      eventType: 'decision.finalized',
      objectType: 'assessment',
      objectId: 'asm-b',
    });
    expect(await processAuditOutboxBatch(20)).toBe(2);
    const chainA = await verifyTenantChain('org-chain-a');
    const chainB = await verifyTenantChain('org-chain-b');
    expect(chainA).toMatchObject({ ok: true, checked: 1 });
    expect(chainB).toMatchObject({ ok: true, checked: 1 });
    expect((await counts('org-chain-a')).events[0].event_id).not.toBe(
      (await counts('org-chain-b')).events[0].event_id,
    );

    const admin = adminClient();
    await admin.connect();
    try {
      await admin.query(`UPDATE audit_hash_chain SET hash = 'deadbeef' WHERE tenant_id = 'org-chain-b'`);
    } finally {
      await admin.end();
    }
    const tampered = await verifyTenantChain('org-chain-b');
    expect(tampered.ok).toBe(false);
    expect(tampered.firstBreakSeq).toBe(1);
    expect((await verifyTenantChain('org-chain-a')).ok).toBe(true);
  });

  it('preserves append-only denials for the application role', async () => {
    const restricted = appClient();
    await restricted.connect();
    try {
      await expect(restricted.query(`UPDATE audit_events SET event_type = 'tampered'`)).rejects.toMatchObject({
        code: '42501',
      });
      await expect(restricted.query('DELETE FROM audit_hash_chain')).rejects.toMatchObject({
        code: '42501',
      });
      await expect(restricted.query('DELETE FROM audit_outbox')).rejects.toMatchObject({
        code: '42501',
      });
    } finally {
      await restricted.end();
    }
  });

  it('does not open a pool when the spine is disabled', async () => {
    await closeAuditPool();
    process.env.AUDIT_SPINE_ENABLED = 'false';
    process.env.AUDIT_DATABASE_URL = 'postgres://127.0.0.1:1/refuse-disabled-spine';
    const result = await emitAuditIntent({
      eventId: materialAuditEventId(['org-disabled', 'vendor.created', 'vendor-disabled']),
      tenantId: 'org-disabled',
      eventType: 'vendor.created',
    });
    expect(result).toEqual({
      queued: false,
      skipped: true,
      reason: 'AUDIT_SPINE_ENABLED=false',
    });
    expect(getAuditPool()).toBeNull();
    process.env.AUDIT_SPINE_ENABLED = 'true';
    process.env.AUDIT_DATABASE_URL = `postgres://${APP_USER}@${FIXTURE.host}:${FIXTURE.port}/${FIXTURE.database}`;
    await closeAuditPool();
  });
});
