import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_PLAN_ID, DEFAULT_SEAT_CAP, DEFAULT_VENDOR_CAP, PLANS } from './plans';

/** @deprecated Prefer DEFAULT_SEAT_CAP from `./plans`. Re-exported for existing imports. */
export { DEFAULT_SEAT_CAP };

interface NewProfileFields {
  email: string | null;
  displayName: string;
}

export type BootstrapJoinRole = 'admin' | 'member';

export class InviteLookupUnavailableError extends Error {
  readonly code = 'invite-lookup-unavailable';

  constructor() {
    super('Unable to verify pending organization invite. Retry profile setup.');
    this.name = 'InviteLookupUnavailableError';
  }
}

/**
 * Invite role is server/invite-authoritative. Unknown or privileged-looking
 * client-supplied values collapse to member — only an invite that already
 * carries role=admin may grant admin.
 */
export function resolveBootstrapJoinRole(inviteRole: unknown): BootstrapJoinRole {
  return inviteRole === 'admin' ? 'admin' : 'member';
}

/**
 * Create the Firestore profile for a brand-new authenticated user (their
 * users/{uid} doc doesn't exist yet). If there's a pending org_invites entry
 * matching their email, they join that organization with the invited role
 * instead of getting a brand-new one — this is what makes multi-user
 * organizations possible instead of every signup creating its own org.
 *
 * Both branches (join vs. create) are a single atomic writeBatch: either
 * everything is persisted, or nothing is — no orphaned org, no half-joined
 * user, no duplicate org created on retry.
 *
 * Scope: this only runs for a user with no existing profile. An existing
 * user cannot currently use an invite to join a second organization —
 * multi-org membership per user is a bigger feature, not attempted here.
 *
 * Issue #61: organizationId and role are never taken from caller input.
 * Join writes inviteId so Firestore rules can re-verify the pending invite.
 */
const inflightBootstraps = new Map<string, Promise<void>>();
const inflightSeatClaims = new Map<string, Promise<void>>();
const finishedSeatClaims = new Set<string>();
let pendingSignupProfile: { email: string; displayName: string } | null = null;

function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Sign-up race (#124 finding, 2026-10-31): createUserWithEmailAndPassword fires
 * onAuthStateChanged before signUpWithEmail has set the display name, so
 * AuthContext's auto-init and signUpWithEmail both bootstrapped the same uid.
 * The first batch won with the placeholder name ("New User's Organization");
 * the second was correctly denied by the rules (the profile already existed),
 * which surfaced as a permission-denied sign-up error.
 *
 * Call this before createUserWithEmailAndPassword so whichever caller runs the
 * bootstrap uses the name the person actually typed.
 */
export function rememberSignupProfile(email: string, displayName: string): void {
  const normalized = normalizeEmail(email);
  const name = displayName.trim();
  pendingSignupProfile = normalized && name ? { email: normalized, displayName: name } : null;
}

export function clearSignupProfile(): void {
  pendingSignupProfile = null;
}

function resolveProfileFields(fields: NewProfileFields): NewProfileFields {
  const pending = pendingSignupProfile;
  if (pending && pending.email === normalizeEmail(fields.email)) {
    return { email: fields.email, displayName: pending.displayName };
  }
  return fields;
}

function isPermissionDenied(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === 'permission-denied',
  );
}

/** Test-only: reset module state between cases. */
export function __resetBootstrapStateForTests(): void {
  inflightBootstraps.clear();
  inflightSeatClaims.clear();
  finishedSeatClaims.clear();
  pendingSignupProfile = null;
}

/**
 * Raise organizations.seatCount by one and set users/{uid}.seatCountApplied,
 * in one transaction, only when this profile was created with the marker false.
 * A retry sees the marker and does not add a second seat. Profiles that omit
 * the field (joins from before this claim) are left alone.
 * Failure is logged. The join itself must already have committed.
 */
export function claimInviteSeat(uid: string, organizationId: string): Promise<void> {
  if (finishedSeatClaims.has(uid)) return Promise.resolve();
  const existing = inflightSeatClaims.get(uid);
  if (existing) return existing;
  const run = claimInviteSeatWithRetry(uid, organizationId).finally(() => {
    inflightSeatClaims.delete(uid);
    finishedSeatClaims.add(uid);
  });
  inflightSeatClaims.set(uid, run);
  return run;
}

async function claimInviteSeatWithRetry(uid: string, organizationId: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const orgRef = doc(db, 'organizations', organizationId);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef);
        const orgSnap = await tx.get(orgRef);
        if (!userSnap.exists()) return;
        if (userSnap.get('seatCountApplied') !== false) return;
        if (userSnap.get('organizationId') !== organizationId) return;
        const current = orgSnap.get('seatCount');
        if (typeof current !== 'number' || !Number.isInteger(current)) {
          throw new Error('orgBootstrap: seatCount is not an integer');
        }
        tx.update(orgRef, { seatCount: current + 1 });
        tx.update(userRef, { seatCountApplied: true });
      });
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn('orgBootstrap: seat count claim failed; user joined regardless', lastErr);
}

/**
 * Single-flight per uid: concurrent callers (AuthContext auto-init, the sign-up
 * form, Google sign-in) share one bootstrap instead of racing two founder batches.
 * If a commit is denied only because the profile was created meanwhile (another
 * tab or an earlier attempt), the existing profile is accepted as success. The
 * rules still decide: nothing here widens what a client may write.
 */
export function bootstrapUserProfile(uid: string, fields: NewProfileFields): Promise<void> {
  const existing = inflightBootstraps.get(uid);
  if (existing) return existing;
  const run = runBootstrapUserProfile(uid, fields).finally(() => {
    inflightBootstraps.delete(uid);
  });
  inflightBootstraps.set(uid, run);
  return run;
}

async function runBootstrapUserProfile(uid: string, rawFields: NewProfileFields): Promise<void> {
  const fields = resolveProfileFields(rawFields);
  const userRef = doc(db, 'users', uid);
  const email = (fields.email || '').trim().toLowerCase();

  let pendingInvite: { id: string; organizationId: string; role?: string } | null = null;
  if (email) {
    // Tenant assignment must be authoritative. An empty successful query means
    // founder bootstrap is allowed; a failed query is UNKNOWN and must not be
    // treated as "no invite", otherwise an invited user could be placed into a
    // brand-new admin organization during a transient Firestore/rules failure.
    try {
      const invitesQuery = query(
        collection(db, 'org_invites'),
        where('email', '==', email),
        where('status', '==', 'pending'),
        limit(1)
      );
      const inviteSnap = await getDocs(invitesQuery);
      if (!inviteSnap.empty) {
        const inviteDoc = inviteSnap.docs[0];
        const data = inviteDoc.data() as { organizationId: string; role?: string };
        pendingInvite = { id: inviteDoc.id, organizationId: data.organizationId, role: data.role };
      }
    } catch (inviteErr) {
      const code =
        inviteErr && typeof inviteErr === 'object' && 'code' in inviteErr
          ? String((inviteErr as { code?: unknown }).code || 'unknown')
          : 'unknown';
      console.error(`orgBootstrap: pending-invite lookup unavailable (${code}); refusing founder fallback`);
      throw new InviteLookupUnavailableError();
    }
  }

  const batch = writeBatch(db);

  if (pendingInvite) {
    batch.set(userRef, {
      email: fields.email,
      displayName: fields.displayName,
      role: resolveBootstrapJoinRole(pendingInvite.role),
      organizationId: pendingInvite.organizationId,
      inviteId: pendingInvite.id,
      onboarded: true,
      createdAt: new Date().toISOString(),
      // False until claimInviteSeat commits the +1. Absence would look like a
      // historical profile and would never be repaired.
      seatCountApplied: false,
    });
    batch.update(doc(db, 'org_invites', pendingInvite.id), {
      status: 'accepted',
      acceptedByUid: uid,
      acceptedAt: new Date().toISOString(),
    });
    // NOTE: the seatCount increment deliberately does NOT live in this batch — see
    // below. Putting it here broke joining entirely.
  } else {
    const orgRef = doc(collection(db, 'organizations'));
    const starter = PLANS[DEFAULT_PLAN_ID];
    batch.set(orgRef, {
      name: `${fields.displayName || 'User'}'s Organization`,
      createdAt: new Date().toISOString(),
      autoCreated: true,
      // P2B: pin residency at create. Dual Firebase wiring comes later; field is immutable.
      dataRegion: 'us',
      // SaaS Starter defaults — Stripe webhook raises planId + caps on paid upgrade.
      planId: starter.id,
      vendorCount: 0,
      vendorCap: DEFAULT_VENDOR_CAP,
      // The creator occupies the first seat.
      seatCount: 1,
      seatCap: DEFAULT_SEAT_CAP,
      subscriptionStatus: 'none',
    });
    batch.set(userRef, {
      email: fields.email,
      displayName: fields.displayName,
      role: 'admin',
      organizationId: orgRef.id,
      onboarded: true,
      createdAt: new Date().toISOString(),
    });
  }

  try {
    await batch.commit();
  } catch (commitErr) {
    if (isPermissionDenied(commitErr)) {
      // A profile created by a concurrent bootstrap is the expected outcome, not a failure.
      let snap: Awaited<ReturnType<typeof getDoc>> | null = null;
      try {
        snap = await getDoc(userRef);
      } catch {
        snap = null;
      }
      if (snap?.exists()) {
        clearSignupProfile();
        if (pendingInvite && typeof snap.data === 'function') {
          const data = snap.data() as { organizationId?: string; seatCountApplied?: boolean };
          if (data?.organizationId === pendingInvite.organizationId && data.seatCountApplied === false) {
            await claimInviteSeat(uid, pendingInvite.organizationId);
          }
        }
        return;
      }
    }
    throw commitErr;
  }
  clearSignupProfile();

  // Seat accounting stays OUTSIDE the profile batch. Rules get no read-your-writes
  // consistency inside a writeBatch, so isOrgMember() cannot see the profile this
  // batch is creating and the whole join used to be rejected. claimInviteSeat runs
  // only after that profile exists. It retries a few times, and a later signed-in
  // session retries once while seatCountApplied is still false. The marker makes a
  // retry a no-op instead of a second seat. Hosted vendorCount is not updated here.
  if (pendingInvite) {
    await claimInviteSeat(uid, pendingInvite.organizationId);
  }
}
