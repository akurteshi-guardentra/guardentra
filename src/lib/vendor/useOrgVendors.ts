import { useCallback, useEffect, useRef, useState } from 'react';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Vendor } from './types';
import { isFirestoreUnavailableError, listLocalVendors, removeLocalVendor } from './localVendorStore';

export type VendorDataMode = 'firestore' | 'local';

export const VENDOR_RETRY_INTERVAL_MS = 30000;

/** Write any local-only vendors (created while Firestore was unreachable) for real,
 * then drop them from the local store — otherwise they'd stay invisible to teammates
 * forever even after Firestore reconnects. */
export async function promoteLocalVendors(orgId: string): Promise<void> {
  const localOnly = listLocalVendors(orgId).filter((v) => v.id.startsWith('local_'));
  for (const vendor of localOnly) {
    try {
      const { id, ...rest } = vendor;
      await addDoc(collection(db, 'vendors'), rest);
      removeLocalVendor(orgId, id);
    } catch (err) {
      console.warn('useOrgVendors: could not promote local-only vendor, will retry next reconnect', err);
    }
  }
}

/**
 * Shared vendor list for Vendors directory consumers (wizard, Assessments).
 * Falls back to localStorage when Firestore is missing or times out, and keeps
 * retrying Firestore in the background (every 30s) rather than staying local-only
 * forever — a reconnect promotes any local-only creates before trusting the cloud
 * snapshot as the full picture.
 */
export function useOrgVendors(orgId?: string | null) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [mode, setMode] = useState<VendorDataMode>('firestore');
  const [loading, setLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const modeRef = useRef<VendorDataMode>('firestore');

  const refreshLocal = useCallback(() => {
    if (!orgId) return;
    const rows = listLocalVendors(orgId);
    setVendors(rows);
    modeRef.current = 'local';
    setMode('local');
    setLoading(false);
  }, [orgId]);

  const retryFirestore = useCallback(() => {
    setRetryTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!orgId) {
      setVendors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let settled = false;
    let unsub: (() => void) | null = null;

    const fallBackLocal = () => {
      if (settled && modeRef.current === 'local') return;
      settled = true;
      if (unsub) {
        unsub();
        unsub = null;
      }
      refreshLocal();
    };

    const failSafe = window.setTimeout(fallBackLocal, 3500);

    try {
      const q = query(collection(db, 'vendors'), where('organizationId', '==', orgId));
      unsub = onSnapshot(
        q,
        async (snap) => {
          if (settled && modeRef.current === 'local') return;
          settled = true;
          window.clearTimeout(failSafe);
          const wasLocal = modeRef.current === 'local';
          if (wasLocal) {
            await promoteLocalVendors(orgId);
          }
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vendor));
          rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setVendors(rows);
          modeRef.current = 'firestore';
          setMode('firestore');
          setLoading(false);
        },
        (err) => {
          console.error('useOrgVendors listen failed', err);
          window.clearTimeout(failSafe);
          if (isFirestoreUnavailableError(err) || true) {
            fallBackLocal();
          }
        }
      );
    } catch (err) {
      console.error('useOrgVendors setup failed', err);
      window.clearTimeout(failSafe);
      fallBackLocal();
    }

    return () => {
      window.clearTimeout(failSafe);
      if (unsub) unsub();
    };
  }, [orgId, refreshLocal, retryTick]);

  // Auto-retry while stuck in local mode, so a transient outage can self-heal
  // without requiring a page reload.
  useEffect(() => {
    if (mode !== 'local') return;
    const interval = window.setInterval(retryFirestore, VENDOR_RETRY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [mode, retryFirestore]);

  return { vendors, mode, loading, refreshLocal, retryFirestore, modeRef };
}
