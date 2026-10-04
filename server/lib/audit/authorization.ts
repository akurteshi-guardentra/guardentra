import { getAdminDb } from '../adminDb.ts';
import type { AuditActorType, AuditEmitEnvelope } from './types.ts';

export type AuditFirebasePrincipal = {
  uid?: string;
  portalAssessmentId?: unknown;
};

export type AuthorizedAuditActor = {
  actorId: string;
  actorType: AuditActorType;
  tenantId: string;
  role?: string;
};

export class AuditAuthorizationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AuditAuthorizationError';
    this.status = status;
    this.code = code;
  }
}

const EVENT_OBJECT_TYPE = new Map<string, 'vendor' | 'assessment' | 'organization'>([
  ['vendor.created', 'vendor'],
  ['vendor.imported', 'vendor'],
  ['vendor.invite_queued', 'vendor'],
  ['triage.completed', 'vendor'],
  ['assessment.created', 'assessment'],
  ['assessment.sent', 'assessment'],
  ['answer.saved', 'assessment'],
  ['evidence.uploaded', 'assessment'],
  ['answer.proposed', 'assessment'],
  ['answer.confirmed', 'assessment'],
  ['assessment.submitted', 'assessment'],
  ['exception.reviewed', 'assessment'],
  ['decision.finalized', 'assessment'],
  ['report.exported', 'assessment'],
  ['audit.chain_verified', 'organization'],
  ['audit.chain_verification_failed', 'organization'],
]);

const PORTAL_EVENT_TYPES = new Set([
  'answer.saved',
  'evidence.uploaded',
  'answer.proposed',
  'answer.confirmed',
  'assessment.submitted',
]);

function requiredId(value: unknown, field: string): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id) throw new AuditAuthorizationError(400, 'invalid_audit_object', `${field} is required`);
  if (id.length > 256) throw new AuditAuthorizationError(400, 'invalid_audit_object', `${field} is too long`);
  return id;
}

function uidOf(principal: AuditFirebasePrincipal | undefined): string {
  const uid = typeof principal?.uid === 'string' ? principal.uid.trim() : '';
  if (!uid) throw new AuditAuthorizationError(401, 'audit_auth_required', 'Authenticated audit principal required');
  return uid;
}

function portalAssessmentOf(principal: AuditFirebasePrincipal | undefined): string | null {
  const value = principal?.portalAssessmentId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function assertObjectTenant(
  collectionName: 'vendors' | 'assessments',
  objectId: string,
  tenantId: string,
): Promise<void> {
  const snap = await getAdminDb().collection(collectionName).doc(objectId).get();
  const objectOrg = snap.exists ? snap.data()?.organizationId : null;
  if (typeof objectOrg !== 'string' || objectOrg !== tenantId) {
    throw new AuditAuthorizationError(
      403,
      'audit_object_forbidden',
      'Audit object is not authorized for this tenant',
    );
  }
}

export async function authorizeAuditTenantRead(
  principal: AuditFirebasePrincipal | undefined,
  requestedTenantId: string,
): Promise<AuthorizedAuditActor> {
  const uid = uidOf(principal);
  if (portalAssessmentOf(principal)) {
    throw new AuditAuthorizationError(
      403,
      'portal_audit_read_forbidden',
      'Portal sessions cannot verify or export organization audit trails',
    );
  }

  const tenantId = requiredId(requestedTenantId, 'tenantId');
  const userSnap = await getAdminDb().collection('users').doc(uid).get();
  const profile = userSnap.exists ? userSnap.data() || {} : {};
  const profileOrg = typeof profile.organizationId === 'string' ? profile.organizationId.trim() : '';
  if (!profileOrg || profileOrg !== tenantId) {
    throw new AuditAuthorizationError(
      403,
      'audit_tenant_forbidden',
      'Audit tenant is not authorized for this user',
    );
  }

  return {
    actorId: uid,
    actorType: 'user',
    tenantId,
    role: typeof profile.role === 'string' ? profile.role : undefined,
  };
}

export async function authorizeAuditEmit(
  principal: AuditFirebasePrincipal | undefined,
  input: AuditEmitEnvelope,
): Promise<AuthorizedAuditActor> {
  const uid = uidOf(principal);
  const tenantId = requiredId(input.tenantId, 'tenantId');
  const expectedObjectType = EVENT_OBJECT_TYPE.get(String(input.eventType || ''));
  if (!expectedObjectType) {
    throw new AuditAuthorizationError(400, 'unsupported_audit_event', 'Unsupported audit event');
  }

  const objectType = typeof input.objectType === 'string' ? input.objectType.trim() : '';
  const objectId = requiredId(input.objectId, 'objectId');
  if (objectType !== expectedObjectType) {
    throw new AuditAuthorizationError(
      400,
      'audit_event_object_mismatch',
      `Audit event ${input.eventType} requires objectType=${expectedObjectType}`,
    );
  }

  const portalAssessmentId = portalAssessmentOf(principal);
  if (portalAssessmentId) {
    if (!PORTAL_EVENT_TYPES.has(String(input.eventType || ''))) {
      throw new AuditAuthorizationError(
        403,
        'portal_audit_event_forbidden',
        'Portal session cannot emit this audit event type',
      );
    }
    if (objectType !== 'assessment' || objectId !== portalAssessmentId) {
      throw new AuditAuthorizationError(
        403,
        'portal_audit_object_forbidden',
        'Portal audit object does not match the scoped assessment',
      );
    }
    await assertObjectTenant('assessments', portalAssessmentId, tenantId);
    return { actorId: uid, actorType: 'portal', tenantId };
  }

  const userActor = await authorizeAuditTenantRead(principal, tenantId);
  if (objectType === 'organization') {
    if (objectId !== tenantId) {
      throw new AuditAuthorizationError(
        403,
        'audit_object_forbidden',
        'Organization audit object must match the authorized tenant',
      );
    }
  } else if (objectType === 'vendor') {
    await assertObjectTenant('vendors', objectId, tenantId);
  } else if (objectType === 'assessment') {
    await assertObjectTenant('assessments', objectId, tenantId);
  }

  return userActor;
}
