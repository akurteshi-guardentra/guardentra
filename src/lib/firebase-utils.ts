import { auth, db } from '../firebase';
import { doc, getDoc, collection, writeBatch } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';

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

export const signInWithGoogle = async () => {
  console.log("firebase-utils: signInWithGoogle started");
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user exists in Firestore
    const userRef = doc(db, 'users', user.uid);
    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (e: any) {
      if (e.code === 'permission-denied') {
        handleFirestoreError(e, OperationType.GET, 'users/' + user.uid);
      }
      throw e;
    }

    if (!userSnap.exists()) {
      // Org + profile are created atomically (single batch) — either both are persisted
      // or neither is, so a failed profile write can never orphan a real organization doc.
      const orgRef = doc(collection(db, 'organizations'));
      try {
        const batch = writeBatch(db);
        batch.set(orgRef, {
          name: `${user.displayName || 'User'}'s Organization`,
          createdAt: new Date().toISOString()
        });
        batch.set(userRef, {
          email: user.email,
          displayName: user.displayName,
          role: 'admin',
          organizationId: orgRef.id,
          onboarded: false,
          createdAt: new Date().toISOString()
        });
        await batch.commit();
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.WRITE, 'organizations+users/' + user.uid);
        }
        throw e;
      }
    }
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log("Sign-in popup was closed by the user.");
    } else if (error.code === 'auth/network-request-failed') {
      console.error("Network Error during Google Sign-in. Likely iframe restriction. Try opening in new tab.");
      throw error;
    } else {
      console.error("Error signing in with Google", error);
      throw error;
    }
  }
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    
    await updateProfile(user, { displayName: name });

    // Org + profile are created atomically (single batch) — either both are persisted
    // or neither is, so a failed profile write can never orphan a real organization doc.
    const userRef = doc(db, 'users', user.uid);
    const orgRef = doc(collection(db, 'organizations'));
    try {
      const batch = writeBatch(db);
      batch.set(orgRef, {
        name: `${name || 'User'}'s Organization`,
        createdAt: new Date().toISOString()
      });
      batch.set(userRef, {
        email: user.email,
        displayName: name,
        role: 'admin',
        organizationId: orgRef.id,
        onboarded: false,
        createdAt: new Date().toISOString()
      });
      await batch.commit();
    } catch (e: any) {
      if (e.code === 'permission-denied') {
        handleFirestoreError(e, OperationType.WRITE, 'organizations+users/' + user.uid);
      }
      throw e;
    }

    return user;
  } catch (error: any) {
    console.error("Error signing up with email", error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error("Error signing in with email", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
