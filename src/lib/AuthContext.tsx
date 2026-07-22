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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          profileUnsubscribe = onSnapshot(userRef, async (userSnap) => {
            console.log("AuthContext: userRef snapshot received. Exists:", userSnap.exists());
            if (userSnap.exists()) {
              const data = userSnap.data() as UserProfile;
              console.log("AuthContext: Profile loaded. Onboarded:", data.onboarded);
              setProfile(data);
              setLoading(false);
            } else {
              // Only attempt auto-initialization once per session if possible
              console.log("AuthContext: Profile missing for authenticated user, attempting auto-initialization...");
              try {
                // Check if organizations exist, if not create one
                console.log("AuthContext: Creating organization...");
                const orgRef = await addDoc(collection(db, 'organizations'), {
                  name: `${currentUser.displayName || 'User'}'s Organization`,
                  createdAt: new Date().toISOString(),
                  autoCreated: true
                });
                console.log("AuthContext: Auto-created organization:", orgRef.id);

                const newProfile = {
                  email: currentUser.email,
                  displayName: currentUser.displayName || 'New User',
                  role: 'admin',
                  organizationId: orgRef.id,
                  onboarded: false,
                  createdAt: new Date().toISOString()
                };

                console.log("AuthContext: Creating user profile document...");
                await setDoc(userRef, newProfile);
                console.log("AuthContext: Auto-created user profile successfully");
                // onSnapshot will fire again once setDoc completes
              } catch (initErr: any) {
                console.error("AuthContext: Auto-initialization failed:", initErr);
                // If it's a permission error, maybe the rules are still deploying or restricting
                if (initErr.code === 'permission-denied') {
                  handleFirestoreError(initErr, OperationType.WRITE, 'profile_auto_init');
                }
                // We MUST set loading false so the app doesn't hang at the loader
                setLoading(false);
              }
            }
          }, (error) => {
            console.error("AuthContext: Snapshot listener error:", error);
            if (error.code === 'permission-denied') {
              handleFirestoreError(error, OperationType.GET, 'users/' + currentUser.uid);
            }
            setLoading(false);
          });
        } catch (error) {
          console.error("Error setting up profile listener:", error);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
        if (profileUnsubscribe) {
          profileUnsubscribe();
          profileUnsubscribe = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
