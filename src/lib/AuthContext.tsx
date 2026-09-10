import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { bootstrapUserProfile } from './orgBootstrap';
import {
  acknowledgeOnboardingComplete,
  clearAllOnboardingAcks,
  clearOnboardingAck,
  hasOnboardingAck,
} from './onboardingAck';
import { clearLocallyOnboarded, setLocallyOnboarded } from './onboardingFlag';
import { isPortalUid } from './vendor/portalAuth';
import { DEMO_FIREBASE_PROJECT_ID } from './firebaseClientConfig';
import { OperationType, handleFirestoreError, isDbMissingError } from './firestoreError';

export interface UserProfile {
  email: string;
  displayName: string;
  role: string;
  organizationId: string;
  organizationName?: string;
  onboarded: boolean;
  subscriptionStatus?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /**
   * Call only after users/{uid}.onboarded=true has been durably persisted.
   * Optimistically marks the in-memory profile onboarded and records a
   * session ack so ProtectedRoute does not bounce to /onboarding before the
   * Firestore listener catches up.
   */
  acknowledgeDurableOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  acknowledgeDurableOnboarding: () => {},
});

const LOCAL_PROFILE_KEY = 'guardentra.localProfile.v1';
const HOSTED_FIREBASE_PROJECT_IDS = new Set(['guardentra-staging', 'guardentra-prod']);

/**
 * Local profile fallback (local_org_*, onboarded often false) is for demo/local
 * only. Hosted staging/prod must treat users/{uid} as authoritative — a timeout
 * or transient error must not manufacture an incomplete profile that bounces a
 * completed cloud user to /onboarding after logout/login.
 */
export function shouldUseLocalProfileFallback(
  projectId: string = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || ''),
): boolean {
  const id = projectId.trim();
  if (HOSTED_FIREBASE_PROJECT_IDS.has(id)) return false;
  // Demo, emulator, unset, or unknown local sandbox may fall back.
  return true;
}

function readLocalProfile(uid: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_PROFILE_KEY}.${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function writeLocalProfile(uid: string, profile: UserProfile) {
  localStorage.setItem(`${LOCAL_PROFILE_KEY}.${uid}`, JSON.stringify(profile));
}

function buildLocalProfile(currentUser: User, opts?: { onboarded?: boolean }): UserProfile {
  const existing = readLocalProfile(currentUser.uid);
  if (existing?.organizationId) {
    return {
      ...existing,
      onboarded: opts?.onboarded ?? existing.onboarded ?? false,
    };
  }
  const profile: UserProfile = {
    email: currentUser.email || 'local@guardentra.dev',
    displayName: currentUser.displayName || 'Local User',
    role: 'admin',
    organizationId: `local_org_${currentUser.uid.slice(0, 8)}`,
    organizationName: 'Local Dev Organization',
    onboarded: opts?.onboarded ?? false,
  };
  writeLocalProfile(currentUser.uid, profile);
  return profile;
}

function applyLocalProfileFallback(
  currentUser: User,
  opts?: { onboarded?: boolean },
): UserProfile | null {
  if (!shouldUseLocalProfileFallback()) {
    console.warn(
      'AuthContext: Cloud profile unavailable; refusing local profile fallback for hosted Firebase project ' +
        `(${String(import.meta.env.VITE_FIREBASE_PROJECT_ID || DEMO_FIREBASE_PROJECT_ID)}).`,
    );
    return null;
  }
  return buildLocalProfile(currentUser, opts);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const acknowledgeDurableOnboarding = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    acknowledgeOnboardingComplete(uid);
    setLocallyOnboarded(uid);
    setProfile((prev) => (prev && prev.onboarded ? prev : prev ? { ...prev, onboarded: true } : prev));
  }, []);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let sawCloudProfile = false;
    let previousUid: string | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      sawCloudProfile = false;
      // Clear ack only on uid change — token refresh must not wipe a pending
      // completion acknowledgement for the same account.
      const nextUid = currentUser?.uid ?? null;
      if (previousUid && previousUid !== nextUid) {
        clearOnboardingAck(previousUid);
      }
      if (!nextUid) {
        clearAllOnboardingAcks();
      }
      previousUid = nextUid;

      setUser(currentUser);
      if (currentUser) {
        if (isPortalUid(currentUser.uid)) {
          setProfile(null);
          setLoading(false);
          return;
        }
        setProfile(null);
        setLoading(true);
        try {
          timeoutId = setTimeout(() => {
            if (!shouldUseLocalProfileFallback()) {
              console.warn(
                'AuthContext: Firestore profile still pending after timeout — keeping cloud-authoritative wait (no local_org fallback).',
              );
              // Leave loading=true / profile=null so ProtectedRoute stays on the
              // spinner until users/{uid} arrives. Never invent onboarded=false.
              return;
            }
            console.warn('AuthContext: Firestore profile timeout — using local profile fallback.');
            const local = buildLocalProfile(currentUser);
            setProfile(local);
            setLoading(false);
          }, 4000);

          const userRef = doc(db, 'users', currentUser.uid);
          profileUnsubscribe = onSnapshot(
            userRef,
            async (userSnap) => {
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              console.log('AuthContext: userRef snapshot received. Exists:', userSnap.exists());
              if (userSnap.exists()) {
                const data = userSnap.data() as UserProfile;
                console.log('AuthContext: Profile loaded. Onboarded:', data.onboarded);
                sawCloudProfile = true;

                if (data.onboarded) {
                  clearOnboardingAck(currentUser.uid);
                  setLocallyOnboarded(currentUser.uid);
                  setProfile(data);
                } else if (hasOnboardingAck(currentUser.uid)) {
                  // Durable write already succeeded this session; listener has not
                  // caught up yet. Keep optimistic onboarded=true — do not clear
                  // the local cache or bounce the user back to onboarding.
                  setProfile({ ...data, onboarded: true });
                } else {
                  clearLocallyOnboarded(currentUser.uid);
                  setProfile(data);
                }
                setLoading(false);
              } else if (sawCloudProfile) {
                console.warn('AuthContext: Cloud profile disappeared after load — clearing session profile.');
                clearOnboardingAck(currentUser.uid);
                setProfile(null);
                setLoading(false);
              } else {
                console.log('AuthContext: Profile missing for authenticated user, attempting auto-initialization...');
                try {
                  await bootstrapUserProfile(currentUser.uid, {
                    email: currentUser.email,
                    displayName: currentUser.displayName || 'New User',
                  });
                  console.log('AuthContext: Auto-created/joined organization + user profile successfully');
                } catch (initErr: any) {
                  console.error('AuthContext: Auto-initialization failed:', initErr);
                  if (initErr?.code === 'permission-denied') {
                    try {
                      handleFirestoreError(initErr, OperationType.WRITE, 'profile_auto_init');
                    } catch {
                      /* logged above; intentionally not re-thrown */
                    }
                  }
                  const local = applyLocalProfileFallback(currentUser, { onboarded: false });
                  setProfile(local);
                  setLoading(false);
                }
              }
            },
            (error) => {
              console.error('AuthContext: Snapshot listener error:', error);
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              if (isDbMissingError(error) || error.code === 'permission-denied') {
                const local = applyLocalProfileFallback(currentUser);
                setProfile(local);
              }
              // Hosted: keep profile null so the UI waits / shows loader rather than
              // routing a real cloud user through incomplete local onboarding.
              setLoading(false);
            },
          );
        } catch (error) {
          console.error('Error setting up profile listener:', error);
          const local = applyLocalProfileFallback(currentUser);
          setProfile(local);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
      clearAllOnboardingAcks();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, acknowledgeDurableOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
