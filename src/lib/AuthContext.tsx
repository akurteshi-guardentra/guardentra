import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  /** Set only when hosted profile load failed after bounded retries (no local_org fallback). */
  profileError: string | null;
  /** Re-attach the cloud users/{uid} listener after a recoverable hosted profile error. */
  retryProfileLoad: () => void;
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
  profileError: null,
  retryProfileLoad: () => {},
  acknowledgeDurableOnboarding: () => {},
});

const LOCAL_PROFILE_KEY = 'guardentra.localProfile.v1';
const HOSTED_FIREBASE_PROJECT_IDS = new Set(['guardentra-staging', 'guardentra-prod']);

/** Hosted listener attach attempts before surfacing a recoverable error. */
export const HOSTED_PROFILE_MAX_ATTEMPTS = 3;
/** Base backoff (ms); delays are base * 2^(attempt-1). */
export const HOSTED_PROFILE_RETRY_BASE_MS = 400;

export const HOSTED_PROFILE_LOAD_ERROR =
  'Unable to load your profile from the cloud. Check your connection, then retry. You can also sign out.';

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
  const [profileError, setProfileError] = useState<string | null>(null);
  const retryProfileLoadRef = useRef<(() => void) | null>(null);

  const acknowledgeDurableOnboarding = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    acknowledgeOnboardingComplete(uid);
    setLocallyOnboarded(uid);
    setProfile((prev) => (prev && prev.onboarded ? prev : prev ? { ...prev, onboarded: true } : prev));
  }, []);

  const retryProfileLoad = useCallback(() => {
    retryProfileLoadRef.current?.();
  }, []);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryId: ReturnType<typeof setTimeout> | null = null;
    let sawCloudProfile = false;
    let previousUid: string | null = null;
    let attempt = 0;
    let disposed = false;
    let activeUser: User | null = null;

    const clearProfileTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const clearRetryTimer = () => {
      if (retryId) {
        clearTimeout(retryId);
        retryId = null;
      }
    };

    const detachProfileListener = () => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }
    };

    const applyCloudProfile = (currentUser: User, data: UserProfile) => {
      sawCloudProfile = true;
      attempt = 0;
      setProfileError(null);
      if (data.onboarded) {
        clearOnboardingAck(currentUser.uid);
        setLocallyOnboarded(currentUser.uid);
        setProfile(data);
      } else if (hasOnboardingAck(currentUser.uid)) {
        setProfile({ ...data, onboarded: true });
      } else {
        clearLocallyOnboarded(currentUser.uid);
        setProfile(data);
      }
      setLoading(false);
    };

    const scheduleHostedRetry = (currentUser: User, reason: string) => {
      if (disposed || activeUser?.uid !== currentUser.uid) return;
      attempt += 1;
      if (attempt >= HOSTED_PROFILE_MAX_ATTEMPTS) {
        console.error(`AuthContext: hosted profile load failed after ${attempt} attempts (${reason}).`);
        if (!sawCloudProfile) {
          // No known-good cloud profile — surface recoverable error (not onboarding).
          setProfileError(HOSTED_PROFILE_LOAD_ERROR);
          setLoading(false);
        }
        // If we already have a cloud profile, keep it usable; do not wipe it.
        return;
      }
      const delay = HOSTED_PROFILE_RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(
        `AuthContext: hosted profile listener issue (${reason}); retry ${attempt}/${HOSTED_PROFILE_MAX_ATTEMPTS} in ${delay}ms`,
      );
      if (!sawCloudProfile) {
        setLoading(true);
        setProfileError(null);
      }
      clearRetryTimer();
      retryId = setTimeout(() => {
        attachProfileListener(currentUser);
      }, delay);
    };

    const attachProfileListener = (currentUser: User) => {
      if (disposed || activeUser?.uid !== currentUser.uid) return;
      detachProfileListener();
      clearProfileTimeout();

      try {
        if (!sawCloudProfile) {
          timeoutId = setTimeout(() => {
            if (disposed || activeUser?.uid !== currentUser.uid || sawCloudProfile) return;
            if (!shouldUseLocalProfileFallback()) {
              console.warn(
                'AuthContext: Firestore profile still pending after timeout — keeping cloud-authoritative wait (no local_org fallback).',
              );
              return;
            }
            console.warn('AuthContext: Firestore profile timeout — using local profile fallback.');
            const local = buildLocalProfile(currentUser);
            setProfile(local);
            setLoading(false);
          }, 4000);
        }

        const userRef = doc(db, 'users', currentUser.uid);
        profileUnsubscribe = onSnapshot(
          userRef,
          async (userSnap) => {
            if (disposed || activeUser?.uid !== currentUser.uid) return;
            clearProfileTimeout();
            console.log('AuthContext: userRef snapshot received. Exists:', userSnap.exists());
            if (userSnap.exists()) {
              applyCloudProfile(currentUser, userSnap.data() as UserProfile);
            } else if (sawCloudProfile) {
              console.warn('AuthContext: Cloud profile disappeared after load — clearing session profile.');
              clearOnboardingAck(currentUser.uid);
              sawCloudProfile = false;
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
                // Listener stays attached; the created doc should arrive as the next snapshot.
              } catch (initErr: any) {
                console.error('AuthContext: Auto-initialization failed:', initErr);
                if (initErr?.code === 'permission-denied') {
                  try {
                    handleFirestoreError(initErr, OperationType.WRITE, 'profile_auto_init');
                  } catch {
                    /* logged above; intentionally not re-thrown */
                  }
                }
                if (shouldUseLocalProfileFallback()) {
                  const local = applyLocalProfileFallback(currentUser, { onboarded: false });
                  setProfile(local);
                  setLoading(false);
                } else {
                  scheduleHostedRetry(currentUser, 'bootstrap-failed');
                }
              }
            }
          },
          (error) => {
            if (disposed || activeUser?.uid !== currentUser.uid) return;
            console.error('AuthContext: Snapshot listener error:', error);
            clearProfileTimeout();
            if (shouldUseLocalProfileFallback()) {
              if (isDbMissingError(error) || error.code === 'permission-denied') {
                const local = applyLocalProfileFallback(currentUser);
                setProfile(local);
              }
              setLoading(false);
              return;
            }
            // Hosted: never invent local_org_*. Preserve last good cloud profile.
            scheduleHostedRetry(currentUser, error?.code || 'listener-error');
          },
        );
      } catch (error) {
        console.error('Error setting up profile listener:', error);
        if (shouldUseLocalProfileFallback()) {
          const local = applyLocalProfileFallback(currentUser);
          setProfile(local);
          setLoading(false);
        } else {
          scheduleHostedRetry(currentUser, 'attach-failed');
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      clearProfileTimeout();
      clearRetryTimer();
      detachProfileListener();
      attempt = 0;
      sawCloudProfile = false;

      const nextUid = currentUser?.uid ?? null;
      if (previousUid && previousUid !== nextUid) {
        clearOnboardingAck(previousUid);
      }
      if (!nextUid) {
        clearAllOnboardingAcks();
      }
      previousUid = nextUid;
      activeUser = currentUser;

      setUser(currentUser);
      setProfileError(null);
      retryProfileLoadRef.current = null;

      if (currentUser) {
        if (isPortalUid(currentUser.uid)) {
          setProfile(null);
          setLoading(false);
          return;
        }
        setProfile(null);
        setLoading(true);
        retryProfileLoadRef.current = () => {
          if (disposed || activeUser?.uid !== currentUser.uid) return;
          attempt = 0;
          setProfileError(null);
          if (!sawCloudProfile) {
            setLoading(true);
          }
          clearRetryTimer();
          attachProfileListener(currentUser);
        };
        attachProfileListener(currentUser);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
      detachProfileListener();
      clearProfileTimeout();
      clearRetryTimer();
      retryProfileLoadRef.current = null;
      clearAllOnboardingAcks();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, profileError, retryProfileLoad, acknowledgeDurableOnboarding }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
