import type { RiskLevel, Vendor } from './types';

const STORAGE_KEY = 'guardentra.localVendors.v1';

type StoreShape = Record<string, Vendor[]>;

function readStore(): StoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoreShape;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: StoreShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listLocalVendors(orgId: string): Vendor[] {
  const rows = readStore()[orgId] || [];
  return [...rows].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function upsertLocalVendor(orgId: string, vendor: Vendor): Vendor {
  const store = readStore();
  const rows = store[orgId] || [];
  const idx = rows.findIndex((v) => v.id === vendor.id);
  if (idx >= 0) rows[idx] = vendor;
  else rows.unshift(vendor);
  store[orgId] = rows;
  writeStore(store);
  return vendor;
}

export function createLocalVendor(
  orgId: string,
  input: {
    name: string;
    category: string;
    criticality: RiskLevel;
    primaryContactName?: string;
    primaryContactEmail?: string;
    ownerName?: string;
  }
): Vendor {
  const vendor: Vendor = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    category: input.category,
    criticality: input.criticality,
    status: 'Active',
    riskScore: 0,
    organizationId: orgId,
    createdAt: new Date().toISOString(),
    primaryContactName: input.primaryContactName?.trim() || undefined,
    primaryContactEmail: input.primaryContactEmail?.trim() || undefined,
    ownerName: input.ownerName || 'Unassigned',
    assessmentStatus: 'Not Started',
  };
  return upsertLocalVendor(orgId, vendor);
}

export function replaceLocalVendors(orgId: string, vendors: Vendor[]) {
  const store = readStore();
  store[orgId] = vendors;
  writeStore(store);
}

/** Detect common Firestore/network failures that should trip local fallback. */
export function isFirestoreUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const code = (err as { code?: string })?.code || '';
  return (
    /database.*not found/i.test(msg) ||
    /failed-precondition/i.test(msg) ||
    /unavailable/i.test(msg) ||
    /timed out/i.test(msg) ||
    /offline/i.test(msg) ||
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    code === 'not-found'
  );
}
