import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, addDoc, collection } from 'firebase/firestore';

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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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

function buildLocalProfile(currentUser: User): UserProfile {
  const existing = readLocalProfile(currentUser.uid);
  if (existing?.organizationId) return { ...existing, onboarded: true };
  const profile: UserProfile = {
    email: currentUser.email || 'local@guardentra.dev',
    displayName: currentUser.displayName || 'Local User',
    role: 'admin',
    organizationId: `local_org_${currentUser.uid.slice(0, 8)}`,
    organizationName: 'Local Dev Organization',
    onboarded: true,
  };
  writeLocalProfile(currentUser.uid, profile);
  return profile;
}

function isDbMissingError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as { code?: string })?.code || '';
  return (
    /database.*not found/i.test(msg) ||
    code === 'failed-precondition' ||
    code === 'unavailable' ||
    code === 'not-found'
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      setUser(currentUser);
      if (currentUser) {
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
                setProfile(data);
                setLoading(false);
              } else {
                console.log('AuthContext: Profile missing for authenticated user, attempting auto-initialization...');
                try {
                  console.log('AuthContext: Creating organization...');
                  const orgRef = await addDoc(collection(db, 'organizations'), {
                    name: `${currentUser.displayName || 'User'}'s Organization`,
                    createdAt: new Date().toISOString(),
                    autoCreated: true,
                  });
                  console.log('AuthContext: Auto-created organization:', orgRef.id);

                  const newProfile = {
                    email: currentUser.email,
                    displayName: currentUser.displayName || 'New User',
                    role: 'admin',
                    organizationId: orgRef.id,
                    onboarded: false,
                    createdAt: new Date().toISOString(),
                  };

                  console.log('AuthContext: Creating user profile document...');
                  await setDoc(userRef, newProfile);
                  console.log('AuthContext: Auto-created user profile successfully');
                } catch (initErr: any) {
                  console.error('AuthContext: Auto-initialization failed:', initErr);
                  if (isDbMissingError(initErr) || initErr?.code === 'permission-denied') {
                    const local = buildLocalProfile(currentUser);
                    setProfile(local);
                  } else if (initErr.code === 'permission-denied') {
                    handleFirestoreError(initErr, OperationType.WRITE, 'profile_auto_init');
                  }
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
