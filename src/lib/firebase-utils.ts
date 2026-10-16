import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile } from 'firebase/auth';
import { bootstrapUserProfile } from './orgBootstrap';

import { OperationType, handleFirestoreError } from './firestoreError';

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

export const logOut = async (redirectTo: string = '/') => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
  } finally {
    // Hard navigate so we leave AppAuthenticated (ProtectedRoute would otherwise
    // send an unauthenticated user to /login). Default is the public home page.
    // Do not use /dashboard here — it is auth-gated and redirects to /login.
    window.location.assign(redirectTo);
  }
};

export type VerificationRecipient = {
  uid?: string;
  isAnonymous?: boolean;
  email?: string | null;
  emailVerified?: boolean;
};

export type VerificationResendResult =
  | { status: 'sent'; uid: string }
  | { status: 'no-user' }
  | { status: 'anonymous' }
  | { status: 'already-verified'; uid: string }
  | { status: 'session-changed'; uid: string };

/** No send unless the current Auth user has an email and is not yet verified. */
export function classifyVerificationRecipient(
  user: VerificationRecipient | null | undefined,
): 'no-user' | 'anonymous' | 'already-verified' | 'eligible' {
  if (!user?.uid) return 'no-user';
  if (user.isAnonymous || !user.email) return 'anonymous';
  if (user.emailVerified) return 'already-verified';
  return 'eligible';
}

type VerificationSender = {
  getUser: () => VerificationRecipient | null | undefined;
  send: (user: VerificationRecipient) => Promise<void>;
};

/**
 * Requests a verification email for the current Auth user.
 * A missing, anonymous, or already-verified user is an explicit result, not success.
 * Success is returned only when the same uid is still signed in after the request.
 */
export const resendVerificationEmail = async (
  deps?: VerificationSender,
): Promise<VerificationResendResult> => {
  const getUser = deps?.getUser ?? (() => auth.currentUser);
  const send = deps?.send ?? ((user: VerificationRecipient) => sendEmailVerification(user as never));
  const user = getUser();
  const decision = classifyVerificationRecipient(user);
  if (!user || decision === 'no-user') return { status: 'no-user' };
  if (decision === 'anonymous') return { status: 'anonymous' };
  if (decision === 'already-verified') return { status: 'already-verified', uid: user.uid as string };
  const uid = user.uid as string;
  try {
    await send(user);
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : 'unknown';
    console.error('Error resending verification email', code);
    throw error;
  }
  const current = getUser();
  if (!current || current.uid !== uid) return { status: 'session-changed', uid };
  return { status: 'sent', uid };
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Error sending password reset email", error);
    throw error;
  }
};
