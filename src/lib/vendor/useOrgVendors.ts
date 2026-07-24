import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Vendor } from './types';
import { isFirestoreUnavailableError, listLocalVendors } from './localVendorStore';

export type VendorDataMode = 'firestore' | 'local';

/**
 * Shared vendor list for Vendors directory consumers (wizard, Assessments).
 * Falls back to localStorage when Firestore is missing or times out.
 */
export function useOrgVendors(orgId?: string | null) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [mode, setMode] = useState<VendorDataMode>('firestore');
  const [loading, setLoading] = useState(true);
  const modeRef = useRef<VendorDataMode>('firestore');

  const refreshLocal = useCallback(() => {
    if (!orgId) return;
    const rows = listLocalVendors(orgId);
    setVendors(rows);
    modeRef.current = 'local';
    setMode('local');
    setLoading(false);
  }, [orgId]);

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
        (snap) => {
          if (settled && modeRef.current === 'local') return;
          settled = true;
          window.clearTimeout(failSafe);
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
  }, [orgId, refreshLocal]);

  return { vendors, mode, loading, refreshLocal, modeRef };
}
