import { createHash } from 'node:crypto';
import type {
  DocumentReference,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import { getAdminDb } from '../adminDb.ts';
import { emitAuditIntent } from './emitIntent.ts';
import { isAuditSpineEnabled } from './pool.ts';
import { redactAuditPayload } from './redact.ts';
import type { AuditEmitEnvelope } from './types.ts';

export const MATERIAL_AUDIT_COLLECTION = 'audit_material_intents';

export type MaterialAuditIntentState =
  | 'pending'
  | 'processing'
  | 'relayed'
  | 'dead';

export type MaterialAuditIntentDocument = {
  eventId: string;
  envelope: AuditEmitEnvelope & { eventId: string };
  state: MaterialAuditIntentState;
  attempts: number;
  nextAttemptAtMs: number;
  leaseUntilMs: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  relayedAt?: string | null;
};

export type PreparedMaterialAuditIntent = {
  ref: DocumentReference;
  exists: boolean;
  document: MaterialAuditIntentDocument;
};

export function materialAuditEventId(parts: Array<string | number | null | undefined>): string {
  const normalized = parts
    .map((part) => String(part ?? '').trim())
    .join('\u001f');
  return `mat_${createHash('sha256').update(normalized, 'utf8').digest('hex')}`;
}

export function buildMaterialAuditIntentDocument(
  input: AuditEmitEnvelope & { eventId: string },
  nowIso = new Date().toISOString(),
): MaterialAuditIntentDocument {
  if (!input.eventId?.trim()) throw new Error('material audit eventId is required');
  if (!input.tenantId?.trim()) throw new Error('material audit tenantId is required');
  if (!input.eventType?.trim()) throw new Error('material audit eventType is required');

  const envelope: AuditEmitEnvelope & { eventId: string } = {
    eventId: input.eventId.trim(),
    tenantId: input.tenantId.trim(),
    eventType: input.eventType.trim(),
    actorId: input.actorId ?? null,
    actorType: input.actorType || 'user',
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    payload: redactAuditPayload(input.payload || {}) as Record<string, unknown>,
    schemaVersion: input.schemaVersion ?? 1,
    createdAt: input.createdAt || nowIso,
  };

  return {
    eventId: envelope.eventId,
    envelope,
    state: 'pending',
    attempts: 0,
    nextAttemptAtMs: 0,
    leaseUntilMs: 0,
    lastError: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    relayedAt: null,
  };
}

/**
 * Reads the journal document before the caller performs any Firestore writes.
 * The caller must then commit the prepared journal entry in the same transaction
 * as the product mutation with commitPreparedMaterialAuditIntent().
 */
export async function prepareMaterialAuditIntent(
  tx: Transaction,
  db: Firestore,
  input: AuditEmitEnvelope & { eventId: string },
): Promise<PreparedMaterialAuditIntent> {
  const document = buildMaterialAuditIntentDocument(input);
  const ref = db.collection(MATERIAL_AUDIT_COLLECTION).doc(document.eventId);
  const snap = await tx.get(ref);
  return {
    ref,
    exists: snap.exists,
    document,
  };
}

export function commitPreparedMaterialAuditIntent(
  tx: Transaction,
  prepared: PreparedMaterialAuditIntent,
): void {
  if (!prepared.exists) {
    tx.create(prepared.ref, prepared.document);
  }
}

function relayMaxAttempts(): number {
  return Math.max(
    1,
    parseInt(process.env.AUDIT_MATERIAL_MAX_ATTEMPTS || '8', 10) || 8,
  );
}

function relayLeaseMs(): number {
  const raw =
    parseInt(process.env.AUDIT_MATERIAL_LEASE_SECONDS || '60', 10) || 60;
  return Math.max(5, Math.min(3600, raw)) * 1000;
}

function relayBackoffMs(attempts: number): number {
  const seconds = Math.min(3600, 2 ** Math.min(Math.max(1, attempts), 10));
  return seconds * 1000;
}

function safeRelayError(err: unknown): string {
  return String(err instanceof Error ? err.message : err || 'unknown relay error').slice(
    0,
    1000,
  );
}

export type MaterialAuditRelayDeps = {
  db?: Firestore;
  emit?: typeof emitAuditIntent;
  now?: () => Date;
};

type ClaimedMaterialIntent = {
  ref: DocumentReference;
  data: MaterialAuditIntentDocument;
};

/**
 * Relay the durable Firestore journal into the existing Postgres audit_outbox.
 *
 * Safety properties:
 * - disabled audit spine leaves the Firestore intent pending;
 * - deterministic eventId makes Postgres insertion idempotent;
 * - a crash after Postgres insert but before Firestore acknowledgement is safe:
 *   the stale lease is reclaimed and the same eventId is relayed again, where
 *   audit_outbox ON CONFLICT deduplicates it;
 * - repeated relay failures remain durable/observable and eventually become dead.
 */
export async function processMaterialAuditIntentBatch(
  limit = 20,
  deps: MaterialAuditRelayDeps = {},
): Promise<number> {
  if (!isAuditSpineEnabled()) return 0;

  const db = deps.db || getAdminDb();
  const emit = deps.emit || emitAuditIntent;
  const now = deps.now || (() => new Date());
  const nowMs = now().getTime();

  const snapshot = await db
    .collection(MATERIAL_AUDIT_COLLECTION)
    .where('state', 'in', ['pending', 'processing'])
    .limit(Math.max(1, limit))
    .get();

  let relayed = 0;

  for (const candidate of snapshot.docs) {
    const claimed = await db.runTransaction(
      async (tx): Promise<ClaimedMaterialIntent | null> => {
        const fresh = await tx.get(candidate.ref);
        if (!fresh.exists) return null;
        const data = fresh.data() as MaterialAuditIntentDocument;
        if (!data?.envelope?.eventId || data.eventId !== data.envelope.eventId) {
          tx.update(candidate.ref, {
            state: 'dead',
            lastError: 'invalid material audit envelope',
            updatedAt: now().toISOString(),
            leaseUntilMs: 0,
          });
          return null;
        }

        const nextAttemptAtMs = Number(data.nextAttemptAtMs || 0);
        if (nextAttemptAtMs > nowMs) return null;

        if (data.state === 'processing') {
          const leaseUntilMs = Number(data.leaseUntilMs || 0);
          if (leaseUntilMs > nowMs) return null;
        } else if (data.state !== 'pending') {
          return null;
        }

        tx.update(candidate.ref, {
          state: 'processing',
          leaseUntilMs: nowMs + relayLeaseMs(),
          updatedAt: now().toISOString(),
          lastError:
            data.state === 'processing'
              ? 'stale material audit lease reclaimed'
              : data.lastError || null,
        });

        return { ref: candidate.ref, data };
      },
    );

    if (!claimed) continue;

    try {
      const result = await emit(claimed.data.envelope);
      if ('skipped' in result && result.skipped) {
        await claimed.ref.update({
          state: 'pending',
          leaseUntilMs: 0,
          lastError: result.reason,
          updatedAt: now().toISOString(),
        });
        continue;
      }

      await claimed.ref.update({
        state: 'relayed',
        leaseUntilMs: 0,
        lastError: null,
        relayedAt: now().toISOString(),
        updatedAt: now().toISOString(),
      });
      relayed += 1;
    } catch (err) {
      const attempts = Number(claimed.data.attempts || 0) + 1;
      const dead = attempts >= relayMaxAttempts();
      await claimed.ref.update({
        state: dead ? 'dead' : 'pending',
        attempts,
        nextAttemptAtMs: dead ? 0 : now().getTime() + relayBackoffMs(attempts),
        leaseUntilMs: 0,
        lastError: safeRelayError(err),
        updatedAt: now().toISOString(),
      });
    }
  }

  return relayed;
}
