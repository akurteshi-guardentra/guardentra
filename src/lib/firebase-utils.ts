import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile } from 'firebase/auth';
import { bootstrapUserProfile } from './orgBootstrap';

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
      // Joins an existing org if there's a pending invite for this email, otherwise
      // creates a new org — atomically either way (see orgBootstrap.ts).
      try {
        await bootstrapUserProfile(user.uid, {
          email: user.email,
          displayName: user.displayName || 'New User',
        });
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

    // Joins an existing org if there's a pending invite for this email, otherwise
    // creates a new org — atomically either way (see orgBootstrap.ts).
    try {
      await bootstrapUserProfile(user.uid, { email: user.email, displayName: name });
    } catch (e: any) {
      if (e.code === 'permission-denied') {
        handleFirestoreError(e, OperationType.WRITE, 'organizations+users/' + user.uid);
      }
      throw e;
    }

    // Best-effort — a verification-email failure shouldn't block account creation.
    try {
      await sendEmailVerification(user);
    } catch (e) {
      console.warn('Could not send verification email', e);
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

export const resendVerificationEmail = async () => {
  if (!auth.currentUser) return;
  try {
    await sendEmailVerification(auth.currentUser);
  } catch (error) {
    console.error("Error resending verification email", error);
    throw error;
  }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Error sending password reset email", error);
    throw error;
  }
};
