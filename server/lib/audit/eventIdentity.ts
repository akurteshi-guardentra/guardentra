import { createHash } from 'node:crypto';

/**
 * Material event identity mapping, version mat-uuid-v1.
 *
 * Firestore journal ids stay `mat_` plus the full SHA-256 hex digest from
 * materialAuditEventId(). PostgreSQL event_id columns stay UUID. This module
 * is the only place that derives the UUID.
 *
 * mat-uuid-v1 is RFC 4122 UUID version 5 (SHA-1) of the entire source id,
 * including the `mat_` prefix. It is not a truncation or strip of that id.
 * The namespace is UUID v5 of the DNS name `audit.guardentra.com` under the
 * RFC 4122 DNS namespace. The full source id is stored beside the UUID; the
 * mapping is one-way and stable across retries.
 *
 * A value that is already a UUID is canonicalized to the lowercase form
 * PostgreSQL returns. Resolving that UUID again does not derive a new id.
 */
export const MATERIAL_EVENT_ID_MAPPING_VERSION = 'mat-uuid-v1' as const;

export const AUDIT_EVENT_DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export const MATERIAL_EVENT_ID_NAMESPACE = '68217ea0-def2-5886-9e2f-d6f33c2e117c';

const MATERIAL_EVENT_ID = /^mat_[0-9a-f]{64}$/;
const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EVENT_ID_LENGTH = 68;

export type MaterialEventIdMapping = {
  version: typeof MATERIAL_EVENT_ID_MAPPING_VERSION;
  algorithm: 'uuid-v5';
  namespace: typeof MATERIAL_EVENT_ID_NAMESPACE;
};

export type ResolvedAuditEventIdentity = {
  sqlEventId: string;
  sourceEventId: string;
  mapping: MaterialEventIdMapping | null;
};

export class AuditEventIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditEventIdentityError';
  }
}

export function uuidV5(name: string, namespaceUuid: string): string {
  if (!UUID_TEXT.test(namespaceUuid)) {
    throw new AuditEventIdentityError('unsupported audit event id');
  }
  const namespace = Buffer.from(namespaceUuid.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(namespace).update(name, 'utf8').digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_TEXT_EXACT = UUID_TEXT;

export function canonicalUuidText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!UUID_TEXT_EXACT.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

type OutboxRecord = {
  eventId?: unknown;
  sourceEventId?: unknown;
  eventIdMapping?: unknown;
  tenantId?: unknown;
  eventType?: unknown;
  objectType?: unknown;
  objectId?: unknown;
  payload?: unknown;
};

export type OutboxRetryIdentity = {
  tenantId: string;
  eventId: string;
  sourceEventId: string;
  eventType: string;
  objectType?: string | null;
  objectId?: string | null;
  eventIdMapping: MaterialEventIdMapping | null;
};

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function payloadRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function auditIdentity(payload: unknown): Record<string, unknown> | null | undefined {
  const record = payloadRecord(payload);
  if (!record || !hasOwn(record, 'auditIdentity')) return undefined;
  const identity = record.auditIdentity;
  if (identity == null) return null;
  if (typeof identity !== 'object' || Array.isArray(identity)) return null;
  return identity as Record<string, unknown>;
}

/**
 * A pre-mapping outbox row is only the original emitter envelope: a UUID
 * eventId, tenant, event type, and object. It has no sourceEventId,
 * eventIdMapping, or auditIdentity. Missing metadata is not inferred for any
 * other shape.
 */
export function isLegacyNativeUuidEnvelope(stored: object): boolean {
  const record = stored as OutboxRecord;
  if (!canonicalUuidText(record.eventId)) return false;
  if (hasOwn(stored, 'sourceEventId') || hasOwn(stored, 'eventIdMapping')) return false;
  const identity = auditIdentity(record.payload);
  return identity === undefined;
}

function materialProvenanceMatches(stored: OutboxRecord, columnEventId: string): boolean {
  if (typeof stored.sourceEventId !== 'string' || !MATERIAL_EVENT_ID.test(stored.sourceEventId)) {
    return false;
  }
  const mapping = stored.eventIdMapping;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return false;
  const mapped = mapping as Partial<MaterialEventIdMapping>;
  if (
    mapped.version !== MATERIAL_EVENT_ID_MAPPING_VERSION ||
    mapped.algorithm !== 'uuid-v5' ||
    mapped.namespace !== MATERIAL_EVENT_ID_NAMESPACE
  ) {
    return false;
  }
  const identity = auditIdentity(stored.payload);
  if (!identity) return false;
  if (identity.mappingVersion !== MATERIAL_EVENT_ID_MAPPING_VERSION) return false;
  if (identity.sourceEventId !== stored.sourceEventId) return false;
  if (identity.sqlEventId !== columnEventId) return false;
  const resolved = resolveAuditEventIdentity(stored.sourceEventId);
  return resolved.sqlEventId === columnEventId && resolved.mapping?.version === mapped.version;
}

function nativeProvenanceMatches(stored: OutboxRecord, columnEventId: string): boolean {
  if (!hasOwn(stored, 'sourceEventId') || !hasOwn(stored, 'eventIdMapping')) return false;
  if (stored.eventIdMapping != null) return false;
  if (canonicalUuidText(stored.sourceEventId) !== columnEventId) return false;
  return auditIdentity(stored.payload) === undefined;
}

/**
 * Checks the claimed outbox row against its own payload. This does not derive
 * a replacement id and does not rewrite the row.
 */
export function assertOutboxProvenance(row: {
  event_id: unknown;
  tenant_id: unknown;
  payload: unknown;
}): void {
  const columnEventId = canonicalUuidText(row.event_id);
  if (!columnEventId || typeof row.tenant_id !== 'string' || !row.tenant_id.trim()) {
    throw new AuditEventIdentityError('audit event identity conflict');
  }
  if (!row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) {
    throw new AuditEventIdentityError('audit event identity conflict');
  }
  const stored = row.payload as OutboxRecord;
  if (stored.tenantId !== row.tenant_id) {
    throw new AuditEventIdentityError('audit event identity conflict');
  }
  if (canonicalUuidText(stored.eventId) !== columnEventId) {
    throw new AuditEventIdentityError('audit event identity conflict');
  }
  if (typeof stored.eventType !== 'string' || !stored.eventType.trim()) {
    throw new AuditEventIdentityError('audit event identity conflict');
  }
  if (isLegacyNativeUuidEnvelope(row.payload)) return;
  const sourceIsMaterial =
    typeof stored.sourceEventId === 'string' && MATERIAL_EVENT_ID.test(stored.sourceEventId);
  const mappingPresent =
    hasOwn(stored, 'eventIdMapping') &&
    stored.eventIdMapping != null;
  const identityPresent = auditIdentity(stored.payload) != null;
  if (sourceIsMaterial || mappingPresent || identityPresent) {
    if (!materialProvenanceMatches(stored, columnEventId)) {
      throw new AuditEventIdentityError('audit event identity conflict');
    }
    return;
  }
  if (!nativeProvenanceMatches(stored, columnEventId)) {
    throw new AuditEventIdentityError('audit event identity conflict');
  }
}

export function outboxRetryMatches(
  storedPayload: unknown,
  columnTenantId: string,
  incoming: OutboxRetryIdentity,
): boolean {
  try {
    assertOutboxProvenance({
      event_id: incoming.eventId,
      tenant_id: columnTenantId,
      payload: storedPayload,
    });
  } catch {
    return false;
  }
  if (!storedPayload || typeof storedPayload !== 'object' || Array.isArray(storedPayload)) {
    return false;
  }
  const stored = storedPayload as OutboxRecord;
  if (columnTenantId !== incoming.tenantId || stored.tenantId !== incoming.tenantId) return false;
  if (stored.eventType !== incoming.eventType) return false;
  if ((stored.objectType ?? null) !== (incoming.objectType ?? null)) return false;
  if ((stored.objectId ?? null) !== (incoming.objectId ?? null)) return false;
  if (isLegacyNativeUuidEnvelope(storedPayload)) {
    return incoming.eventIdMapping == null && incoming.sourceEventId === incoming.eventId;
  }
  if (incoming.eventIdMapping) {
    return (
      stored.sourceEventId === incoming.sourceEventId &&
      materialProvenanceMatches(stored, incoming.eventId)
    );
  }
  return (
    incoming.sourceEventId === incoming.eventId &&
    canonicalUuidText(stored.sourceEventId) === incoming.sourceEventId
  );
}

export function persistedEventOriginMatches(
  row: {
    tenant_id?: unknown;
    event_type?: unknown;
    object_type?: unknown;
    object_id?: unknown;
    payload?: unknown;
  },
  envelope: {
    tenantId: string;
    eventId: string;
    eventType: string;
    objectType?: string | null;
    objectId?: string | null;
    payload?: Record<string, unknown> | null;
  },
): boolean {
  if (row.tenant_id !== envelope.tenantId) return false;
  if (row.event_type !== envelope.eventType) return false;
  if ((row.object_type ?? null) !== (envelope.objectType ?? null)) return false;
  if ((row.object_id ?? null) !== (envelope.objectId ?? null)) return false;
  const stored = auditIdentity(row.payload);
  const incoming = auditIdentity(envelope.payload);
  if (stored === undefined && incoming === undefined) return true;
  if (!stored || !incoming) return false;
  return (
    stored.mappingVersion === incoming.mappingVersion &&
    stored.sourceEventId === incoming.sourceEventId &&
    stored.sqlEventId === incoming.sqlEventId &&
    stored.sqlEventId === envelope.eventId
  );
}

export function resolveAuditEventIdentity(eventId: string): ResolvedAuditEventIdentity {
  const source = eventId.trim();
  if (!source || source.length > MAX_EVENT_ID_LENGTH) {
    throw new AuditEventIdentityError('unsupported audit event id');
  }
  if (MATERIAL_EVENT_ID.test(source)) {
    const namespace = uuidV5('audit.guardentra.com', AUDIT_EVENT_DNS_NAMESPACE);
    if (namespace !== MATERIAL_EVENT_ID_NAMESPACE) {
      throw new AuditEventIdentityError('unsupported audit event id');
    }
    return {
      sqlEventId: uuidV5(source, namespace),
      sourceEventId: source,
      mapping: {
        version: MATERIAL_EVENT_ID_MAPPING_VERSION,
        algorithm: 'uuid-v5',
        namespace: MATERIAL_EVENT_ID_NAMESPACE,
      },
    };
  }
  if (UUID_TEXT.test(source)) {
    const canonical = source.toLowerCase();
    return {
      sqlEventId: canonical,
      sourceEventId: canonical,
      mapping: null,
    };
  }
  throw new AuditEventIdentityError('unsupported audit event id');
}
