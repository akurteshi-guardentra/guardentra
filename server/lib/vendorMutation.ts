import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Request, Response } from 'express';
import { ensureAdmin } from '../middleware/requireFirebaseAuth.ts';
import { getAdminDb } from './adminDb.ts';
import {
  commitPreparedMaterialAuditIntent,
  materialAuditEventId,
  prepareMaterialAuditIntent,
} from './audit/materialIntent.ts';
import { getPlan } from './plans.ts';

const RISK_LEVELS = new Set(['Critical', 'High', 'Medium', 'Low']);

export type VendorCreateSource = 'create' | 'import';

export type VendorCreateInput = {
  name: string;
  category: string;
  criticality: 'Critical' | 'High' | 'Medium' | 'Low';
  primaryContactName?: string;
  primaryContactEmail?: string;
  source: VendorCreateSource;
};

export type VendorCreateResult = {
  vendorId: string;
  deduplicated: boolean;
};

export class VendorMutationError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalize(value: unknown): string {
  return String(value || '').trim();
}

function normalizeIdentity(value: unknown): string {
  return normalize(value).toLowerCase().replace(/\s+/g, ' ');
}

export function parseVendorCreateInput(raw: unknown): VendorCreateInput {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const name = normalize(body.name);
  const category = normalize(body.category);
  const criticality = normalize(body.criticality);
  const primaryContactName = normalize(body.primaryContactName);
  const primaryContactEmail = normalize(body.primaryContactEmail).toLowerCase();
  const source = body.source === 'import' ? 'import' : 'create';

  if (name.length < 2) {
    throw new VendorMutationError(400, 'invalid_vendor', 'Vendor name must be at least 2 characters.');
  }
  if (!category) {
    throw new VendorMutationError(400, 'invalid_vendor', 'Category is required.');
  }
  if (!RISK_LEVELS.has(criticality)) {
    throw new VendorMutationError(400, 'invalid_vendor', 'Criticality is invalid.');
  }
  if (primaryContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryContactEmail)) {
    throw new VendorMutationError(400, 'invalid_vendor', 'Primary contact email is invalid.');
  }

  return {
    name,
    category,
    criticality: criticality as VendorCreateInput['criticality'],
    ...(primaryContactName ? { primaryContactName } : {}),
    ...(primaryContactEmail ? { primaryContactEmail } : {}),
    source,
  };
}

export function deterministicVendorId(
  organizationId: string,
  input: Pick<VendorCreateInput, 'name' | 'category' | 'primaryContactEmail'>,
): string {
  const identity = materialAuditEventId([
    organizationId,
    'vendor.identity',
    normalizeIdentity(input.name),
    normalizeIdentity(input.category),
    normalizeIdentity(input.primaryContactEmail),
  ]);
  return `vendor_${identity.slice('mat_'.length, 'mat_'.length + 40)}`;
}

export async function createVendorWithDurableAudit(input: {
  db: Firestore;
  organizationId: string;
  actorId: string;
  ownerName: string;
  vendor: VendorCreateInput;
  nowIso?: string;
}): Promise<VendorCreateResult> {
  const { db, organizationId, actorId, ownerName, vendor } = input;
  const nowIso = input.nowIso || new Date().toISOString();
  const vendorId = deterministicVendorId(organizationId, vendor);
  const vendorRef = db.collection('vendors').doc(vendorId);
  const orgRef = db.collection('organizations').doc(organizationId);

  return db.runTransaction(async (tx) => {
    const orgSnap = await tx.get(orgRef);
    if (!orgSnap.exists) {
      throw new VendorMutationError(404, 'organization_missing', 'Organization not found.');
    }

    const vendorSnap = await tx.get(vendorRef);
    if (vendorSnap.exists) {
      const existing = vendorSnap.data() || {};
      if (String(existing.organizationId || '') !== organizationId) {
        throw new VendorMutationError(409, 'vendor_identity_conflict', 'Vendor identity conflict.');
      }
      return { vendorId, deduplicated: true };
    }

    const org = orgSnap.data() || {};
    const count = typeof org.vendorCount === 'number' ? org.vendorCount : 0;
    const plan = getPlan(org.planId);
    const cap = typeof org.vendorCap === 'number' ? org.vendorCap : plan.vendorCap;
    if (count >= cap) {
      throw new VendorMutationError(
        409,
        'vendor_cap_reached',
        `Vendor limit reached (${cap} on ${plan.name}). Upgrade your plan to add more vendors.`,
      );
    }

    const eventType = vendor.source === 'import' ? 'vendor.imported' : 'vendor.created';
    const preparedAudit = await prepareMaterialAuditIntent(tx, db, {
      eventId: materialAuditEventId([
        organizationId,
        'vendor.material-create',
        vendorId,
      ]),
      tenantId: organizationId,
      eventType,
      actorId,
      actorType: 'user',
      objectType: 'vendor',
      objectId: vendorId,
      createdAt: nowIso,
      payload: {
        source: vendor.source,
        category: vendor.category,
        criticality: vendor.criticality,
        primaryContactPresent: Boolean(vendor.primaryContactEmail),
      },
    });

    tx.create(vendorRef, {
      name: vendor.name,
      category: vendor.category,
      criticality: vendor.criticality,
      status: 'Active',
      riskScore: 0,
      organizationId,
      createdAt: nowIso,
      ...(vendor.primaryContactName
        ? { primaryContactName: vendor.primaryContactName }
        : {}),
      ...(vendor.primaryContactEmail
        ? { primaryContactEmail: vendor.primaryContactEmail }
        : {}),
      ownerName: ownerName || 'Unassigned',
      assessmentStatus: 'Not Started',
    });
    tx.set(orgRef, { vendorCount: count + 1 }, { merge: true });
    commitPreparedMaterialAuditIntent(tx, preparedAudit);

    return { vendorId, deduplicated: false };
  });
}

export type VendorMutationDeps = {
  verifyIdToken: (token: string) => Promise<DecodedIdToken>;
  getUser: (uid: string) => Promise<Record<string, unknown> | null>;
  createVendor: (args: {
    organizationId: string;
    actorId: string;
    ownerName: string;
    vendor: VendorCreateInput;
  }) => Promise<VendorCreateResult>;
};

export function liveVendorMutationDeps(): VendorMutationDeps {
  return {
    async verifyIdToken(token) {
      ensureAdmin();
      return getAuth().verifyIdToken(token);
    },
    async getUser(uid) {
      ensureAdmin();
      const snap = await getAdminDb().collection('users').doc(uid).get();
      return snap.exists ? (snap.data() as Record<string, unknown>) : null;
    },
    async createVendor(args) {
      ensureAdmin();
      return createVendorWithDurableAudit({
        db: getAdminDb(),
        ...args,
      });
    },
  };
}

function bearerToken(req: Request): string {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function handleOrgVendorCreate(
  req: Request,
  res: Response,
  deps: VendorMutationDeps,
): Promise<void> {
  try {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await deps.verifyIdToken(token);
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const user = await deps.getUser(decoded.uid);
    if (!user) {
      res.status(403).json({ error: 'Organization membership required' });
      return;
    }
    const organizationId = normalize(user.organizationId);
    const role = normalize(user.role || 'member');
    if (!organizationId) {
      res.status(403).json({ error: 'Organization membership required' });
      return;
    }
    if (!['admin', 'owner', 'member'].includes(role)) {
      res.status(403).json({ error: 'Vendor create permission required' });
      return;
    }

    const vendor = parseVendorCreateInput(req.body);
    const ownerName =
      normalize(user.displayName) || normalize(user.email) || decoded.email || 'Unassigned';

    const result = await deps.createVendor({
      organizationId,
      actorId: decoded.uid,
      ownerName,
      vendor,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof VendorMutationError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    console.error('[vendor-create] failed', err);
    res.status(500).json({ error: 'Could not create vendor.' });
  }
}
