import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { bootstrapUserProfile } from './orgBootstrap';
import { isPortalUid } from './vendor/portalAuth';

interface UserProfile {
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
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

import { OperationType, handleFirestoreError, isDbMissingError } from './firestoreError';

const LOCAL_PROFILE_KEY = 'guardentra.localProfile.v1';

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
    // Preserve prior local onboarded state; never force-skip the wizard for a
    // first-run user just because Firestore fell back to local.
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


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    // Once a cloud profile has been observed for this auth uid, a later
    // !exists snapshot means removal/wipe — do not auto-create a new org.
    let sawCloudProfile = false;

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

      setUser(currentUser);
      if (currentUser) {
        // Vendor portal sessions use uid portal_* (and ideally a secondary Auth app).
        // Never bootstrap an org profile for them — that hijacks / pollutes org tenancy.
        if (isPortalUid(currentUser.uid)) {
          setProfile(null);
          setLoading(false);
          return;
        }
        try {
          // Don't hang forever if Firestore never responds (missing DB).
          timeoutId = setTimeout(() => {
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
                setProfile(data);
                setLoading(false);
              } else if (sawCloudProfile) {
                // Profile was deleted after this session had loaded it (Admin SDK /
                // future remove-member). Sign-out would be nicer UX but clearing
                // profile is enough to drop org-scoped UI; re-bootstrap would mint
                // a brand-new org for a removed user.
                console.warn('AuthContext: Cloud profile disappeared after load — clearing session profile.');
                setProfile(null);
                setLoading(false);
              } else {
                console.log('AuthContext: Profile missing for authenticated user, attempting auto-initialization...');
                try {
                  // Joins an existing org if there's a pending invite for this email,
                  // otherwise creates a new org — atomically either way (see
                  // orgBootstrap.ts). Shared with the signUpWithEmail/signInWithGoogle
                  // paths in firebase-utils.ts so there's one place this logic lives.
                  await bootstrapUserProfile(currentUser.uid, {
                    email: currentUser.email,
                    displayName: currentUser.displayName || 'New User',
                  });
                  console.log('AuthContext: Auto-created/joined organization + user profile successfully');
                  // onSnapshot should re-fire with the new doc; if it does not
                  // (offline race), do not leave the shell spinning forever.
                  setLoading(false);
                } catch (initErr: any) {
                  console.error('AuthContext: Auto-initialization failed:', initErr);
                  if (initErr?.code === 'permission-denied') {
                    // handleFirestoreError logs rich diagnostic info but always throws
                    // afterward — swallow that here so we still fall through to the
                    // local-profile fallback and setLoading(false) below, rather than
                    // leaving the UI stuck in a permanent loading state.
                    try {
                      handleFirestoreError(initErr, OperationType.WRITE, 'profile_auto_init');
                    } catch {
                      /* logged above; intentionally not re-thrown */
                    }
                  }
                  // Any bootstrap failure still needs a usable session so Login can
                  // forward into /onboarding instead of a blank protected shell.
                  const local = buildLocalProfile(currentUser, { onboarded: false });
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
                const local = buildLocalProfile(currentUser);
                setProfile(local);
              }
              setLoading(false);
            }
          );
        } catch (error) {
          console.error('Error setting up profile listener:', error);
          const local = buildLocalProfile(currentUser);
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
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
