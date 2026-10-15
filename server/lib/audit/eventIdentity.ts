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
