import { useCallback, useEffect, useRef, useState } from 'react';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Vendor } from './types';
import {
  HOSTED_VENDOR_LOAD_FAILED,
  isFirestoreUnavailableError,
  listLocalVendors,
  removeLocalVendor,
  shouldUseLocalPersistenceFallback,
} from './localVendorStore';

export type VendorDataMode = 'firestore' | 'local' | 'unavailable';

export const VENDOR_RETRY_INTERVAL_MS = 30000;

/** Write any local-only vendors (created while Firestore was unreachable) for real,
 * then drop them from the local store — otherwise they'd stay invisible to teammates
 * forever even after Firestore reconnects. Returns map of localVendorId → cloudVendorId.
 * Hosted environments never promote leftover localStorage into Firestore. */
export async function promoteLocalVendors(orgId: string): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  if (!shouldUseLocalPersistenceFallback()) return idMap;
  const localOnly = listLocalVendors(orgId).filter((v) => v.id.startsWith('local_'));
  for (const vendor of localOnly) {
    try {
      const { id, ...rest } = vendor;
      const ref = await addDoc(collection(db, 'vendors'), rest);
      idMap.set(id, ref.id);
      removeLocalVendor(orgId, id);
    } catch (err) {
      console.warn('useOrgVendors: could not promote local-only vendor, will retry next reconnect', err);
    }
  }
  return idMap;
}

/**
 * Shared vendor list for Vendors directory consumers (wizard, Assessments).
 * Demo/dev may fall back to localStorage when Firestore is missing or times out.
 * Hosted GuardEntra fail-closes: timeout/error never presents local-only rows
 * as authoritative and never claims a durable save.
 */
export function useOrgVendors(orgId?: string | null) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [mode, setMode] = useState<VendorDataMode>('firestore');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const modeRef = useRef<VendorDataMode>('firestore');

  const refreshLocal = useCallback(() => {
    if (!orgId) return;
    if (!shouldUseLocalPersistenceFallback()) {
      setVendors([]);
      modeRef.current = 'unavailable';
      setMode('unavailable');
      setError(HOSTED_VENDOR_LOAD_FAILED);
      setLoading(false);
      return;
    }
    const rows = listLocalVendors(orgId);
    setVendors(rows);
    modeRef.current = 'local';
    setMode('local');
    setError('');
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
    setError('');
    let settled = false;
    let unsub: (() => void) | null = null;
    const allowLocal = shouldUseLocalPersistenceFallback();

    const failClosed = () => {
      if (settled && modeRef.current === 'unavailable') return;
      settled = true;
      if (unsub) {
        unsub();
        unsub = null;
      }
      setVendors([]);
      modeRef.current = 'unavailable';
      setMode('unavailable');
      setError(HOSTED_VENDOR_LOAD_FAILED);
      setLoading(false);
    };

    const fallBackLocal = () => {
      if (!allowLocal) {
        failClosed();
        return;
      }
      if (settled && modeRef.current === 'local') return;
      settled = true;
      if (unsub) {
        unsub();
        unsub = null;
      }
      refreshLocal();
    };

    const failSafe = window.setTimeout(allowLocal ? fallBackLocal : failClosed, 3500);

    try {
      const q = query(collection(db, 'vendors'), where('organizationId', '==', orgId));
      unsub = onSnapshot(
        q,
        async (snap) => {
          if (settled && modeRef.current === 'local') return;
          settled = true;
          window.clearTimeout(failSafe);
          const wasLocal = modeRef.current === 'local';
          if (wasLocal && allowLocal) {
            await promoteLocalVendors(orgId);
          }
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vendor));
          rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setVendors(rows);
          modeRef.current = 'firestore';
          setMode('firestore');
          setError('');
          setLoading(false);
        },
        (err) => {
          console.error('useOrgVendors listen failed', err);
          window.clearTimeout(failSafe);
          if (allowLocal && (isFirestoreUnavailableError(err) || true)) {
            fallBackLocal();
          } else {
            failClosed();
          }
        }
      );
    } catch (err) {
      console.error('useOrgVendors setup failed', err);
      window.clearTimeout(failSafe);
      if (allowLocal) fallBackLocal();
      else failClosed();
    }

    return () => {
      window.clearTimeout(failSafe);
      if (unsub) unsub();
    };
  }, [orgId, refreshLocal, retryTick]);

  // Auto-retry while stuck off Firestore so a transient outage can self-heal
  // without requiring a page reload. Hosted retries never reopen local mode.
  useEffect(() => {
    if (mode !== 'local' && mode !== 'unavailable') return;
    const interval = window.setInterval(retryFirestore, VENDOR_RETRY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [mode, retryFirestore]);

  return { vendors, mode, loading, error, refreshLocal, retryFirestore, modeRef };
}
