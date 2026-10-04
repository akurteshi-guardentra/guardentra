export type NotificationIntentType =
  | 'vendor_welcome'
  | 'assessment_invite'
  | 'assessment_reminder';

export type NotificationIntentRequest = {
  intentType: NotificationIntentType;
  objectId: string;
};

export type NotificationAuthorityUser = {
  organizationId?: unknown;
  role?: unknown;
};

export type NotificationAuthorityVendor = {
  organizationId?: unknown;
  name?: unknown;
  primaryContactEmail?: unknown;
  primaryContactName?: unknown;
};

export type NotificationAuthorityAssessment = {
  organizationId?: unknown;
  vendorId?: unknown;
  vendorName?: unknown;
  frameworkName?: unknown;
  dueAt?: unknown;
  dueDate?: unknown;
  status?: unknown;
  inviteEmail?: unknown;
};

export type NotificationAuthorityOrganization = {
  name?: unknown;
};

export interface NotificationAuthorityStore {
  getUser(uid: string): Promise<NotificationAuthorityUser | null>;
  getVendor(id: string): Promise<NotificationAuthorityVendor | null>;
  getAssessment(id: string): Promise<NotificationAuthorityAssessment | null>;
  getOrganization(id: string): Promise<NotificationAuthorityOrganization | null>;
}

export type ResolvedNotificationIntent = {
  intentType: NotificationIntentType;
  objectId: string;
  organizationId: string;
  recipient: string;
  subject: string;
  text: string;
  queueId: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID_RE = /^[A-Za-z0-9_-]{1,160}$/;
const ALLOWED_ROLES = new Set(['admin', 'member']);

export class NotificationIntentError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'NotificationIntentError';
    this.status = status;
    this.code = code;
  }
}

function cleanLabel(value: unknown, fallback: string, max = 120): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, max);
}

function validEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new NotificationIntentError(409, 'recipient_missing', 'Authoritative recipient email is missing');
  }
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new NotificationIntentError(409, 'recipient_invalid', 'Authoritative recipient email is invalid');
  }
  return email;
}

function assertSameTenant(actual: unknown, expected: string): void {
  if (typeof actual !== 'string' || actual !== expected) {
    throw new NotificationIntentError(403, 'tenant_mismatch', 'Notification object is outside the authenticated organization');
  }
}

function dateLabel(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function reminderDay(now: Date): string {
  return now.toISOString().slice(0, 10).replace(/-/g, '');
}

export function parseNotificationIntentRequest(body: unknown): NotificationIntentRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new NotificationIntentError(400, 'invalid_intent', 'Notification intent is required');
  }

  const input = body as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  if (keys.length !== 2 || keys[0] !== 'intentType' || keys[1] !== 'objectId') {
    throw new NotificationIntentError(
      400,
      'invalid_intent_shape',
      'Only intentType and objectId are accepted'
    );
  }

  const intentType = input.intentType;
  if (
    intentType !== 'vendor_welcome' &&
    intentType !== 'assessment_invite' &&
    intentType !== 'assessment_reminder'
  ) {
    throw new NotificationIntentError(400, 'invalid_intent_type', 'Unsupported notification intent');
  }

  const objectId = typeof input.objectId === 'string' ? input.objectId.trim() : '';
  if (!OBJECT_ID_RE.test(objectId)) {
    throw new NotificationIntentError(400, 'invalid_object_id', 'A valid authoritative object id is required');
  }

  return { intentType, objectId };
}

export function resolvePublicAppUrl(raw: string | undefined, productionLike: boolean): string {
  const value = (raw || '').trim();
  if (!value) {
    if (productionLike) {
      throw new NotificationIntentError(503, 'public_app_url_missing', 'Notification delivery is not configured');
    }
    return 'http://localhost:8080';
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NotificationIntentError(503, 'public_app_url_invalid', 'Notification delivery is not configured');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new NotificationIntentError(503, 'public_app_url_invalid', 'Notification delivery is not configured');
  }

  if (productionLike) {
    if (url.protocol !== 'https:') {
      throw new NotificationIntentError(503, 'public_app_url_insecure', 'Notification delivery is not configured');
    }
  } else if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))
  ) {
    throw new NotificationIntentError(503, 'public_app_url_insecure', 'Notification delivery is not configured');
  }

  return url.origin;
}

export async function resolveNotificationIntent(input: {
  uid: string;
  intent: NotificationIntentRequest;
  store: NotificationAuthorityStore;
  publicAppUrl?: string;
  productionLike?: boolean;
  now?: Date;
}): Promise<ResolvedNotificationIntent> {
  const { uid, intent, store } = input;
  if (!uid) {
    throw new NotificationIntentError(401, 'auth_required', 'Authentication required');
  }

  const actor = await store.getUser(uid);
  if (!actor) {
    throw new NotificationIntentError(403, 'profile_missing', 'Authenticated profile is not authorized');
  }

  const organizationId =
    typeof actor.organizationId === 'string' ? actor.organizationId.trim() : '';
  const role = typeof actor.role === 'string' ? actor.role : '';
  if (!organizationId || !ALLOWED_ROLES.has(role)) {
    throw new NotificationIntentError(403, 'role_not_authorized', 'Authenticated profile is not authorized');
  }

  const organization = await store.getOrganization(organizationId);
  if (!organization) {
    throw new NotificationIntentError(404, 'organization_missing', 'Authoritative organization no longer exists');
  }
  const organizationName = cleanLabel(organization.name, 'A GuardEntra customer');

  if (intent.intentType === 'vendor_welcome') {
    const vendor = await store.getVendor(intent.objectId);
    if (!vendor) {
      throw new NotificationIntentError(404, 'vendor_missing', 'Authoritative vendor no longer exists');
    }
    assertSameTenant(vendor.organizationId, organizationId);
    const recipient = validEmail(vendor.primaryContactEmail);
    const vendorName = cleanLabel(vendor.name, 'your organization');
    const contactName = cleanLabel(vendor.primaryContactName, '', 80);
    const greeting = contactName ? `Hi ${contactName}` : 'Hello';

    return {
      intentType: intent.intentType,
      objectId: intent.objectId,
      organizationId,
      recipient,
      subject: `You've been added as a vendor in Guardentra`,
      text:
        `${greeting},\n\n${organizationName} has added ${vendorName} to its Guardentra vendor register. ` +
        'A security assessment questionnaire may follow separately.\n\nNo action is needed from you yet.',
      queueId: `notify_vendor_welcome_${intent.objectId}`,
    };
  }

  const assessment = await store.getAssessment(intent.objectId);
  if (!assessment) {
    throw new NotificationIntentError(404, 'assessment_missing', 'Authoritative assessment no longer exists');
  }
  assertSameTenant(assessment.organizationId, organizationId);

  const vendorId = typeof assessment.vendorId === 'string' ? assessment.vendorId.trim() : '';
  if (!OBJECT_ID_RE.test(vendorId)) {
    throw new NotificationIntentError(409, 'assessment_vendor_invalid', 'Assessment vendor binding is invalid');
  }

  const vendor = await store.getVendor(vendorId);
  if (!vendor) {
    throw new NotificationIntentError(404, 'vendor_missing', 'Authoritative vendor no longer exists');
  }
  assertSameTenant(vendor.organizationId, organizationId);

  const recipient = validEmail(vendor.primaryContactEmail);
  const vendorName = cleanLabel(vendor.name ?? assessment.vendorName, 'your organization');
  const contactName = cleanLabel(vendor.primaryContactName, '', 80);
  const greeting = contactName ? `Hi ${contactName}` : 'Hello';
  const frameworkName = cleanLabel(assessment.frameworkName, 'Guardentra security assessment', 160);
  const due = dateLabel(assessment.dueAt ?? assessment.dueDate);
  const baseUrl = resolvePublicAppUrl(input.publicAppUrl, input.productionLike ?? true);
  const portalUrl = `${baseUrl}/portal/${encodeURIComponent(intent.objectId)}`;

  if (intent.intentType === 'assessment_reminder') {
    if (typeof assessment.status === 'string' && assessment.status.toLowerCase() === 'completed') {
      throw new NotificationIntentError(409, 'assessment_complete', 'Completed assessments cannot be reminded');
    }

    const dueLine = due ? `\nDue: ${due}\n` : '\n';
    return {
      intentType: intent.intentType,
      objectId: intent.objectId,
      organizationId,
      recipient,
      subject: `Reminder: security assessment pending — ${vendorName}`,
      text:
        `${greeting},\n\nThis is a reminder from ${organizationName} that ${frameworkName} is still awaiting your response.\n\n` +
        `Complete it here: ${portalUrl}\n${dueLine}\nYour progress saves automatically.`,
      queueId: `notify_assessment_reminder_${intent.objectId}_${reminderDay(input.now || new Date())}`,
    };
  }

  const dueLine = due ? `\nDue: ${due}\n` : '\n';
  return {
    intentType: intent.intentType,
    objectId: intent.objectId,
    organizationId,
    recipient,
    subject: `Security assessment request — ${vendorName}`,
    text:
      `${greeting},\n\n${organizationName} has asked ${vendorName} to complete ${frameworkName}.\n\n` +
      `Complete it here: ${portalUrl}\n${dueLine}\nYour progress saves automatically and this link remains tied to this assessment.`,
    queueId: `notify_assessment_invite_${intent.objectId}`,
  };
}
