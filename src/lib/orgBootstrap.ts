import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  updateDoc,
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
  pendingSignupProfile = null;
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
      let alreadyBootstrapped = false;
      try {
        const snap = await getDoc(userRef);
        alreadyBootstrapped = snap.exists();
      } catch {
        alreadyBootstrapped = false;
      }
      if (alreadyBootstrapped) {
        clearSignupProfile();
        return;
      }
    }
    throw commitErr;
  }
  clearSignupProfile();

  // Seat accounting happens AFTER the batch, not inside it, and its failure must never
  // block the join.
  //
  // Security rules get no read-your-writes consistency within a writeBatch: a get() in a
  // rule cannot see a sibling write from the same commit. The organizations update rule
  // calls isOrgMember(orgId), which get()s users/{uid} — a document this very batch is
  // creating. So bundling the increment made the rule evaluate against a non-existent
  // profile, and the ENTIRE batch was rejected: the invited user could not create their
  // profile at all. Verified against the emulator, which is the only way this surfaces.
  //
  // Once the profile is committed the same update passes cleanly. Splitting it costs
  // atomicity, but the failure mode is now benign and in the safe direction: an
  // undercounted seatCount lets an org invite one extra person, whereas the previous
  // arrangement locked every invitee out entirely. That tolerance is consistent with the
  // soft-metering posture already documented for both counters in KNOWN_ISSUES.md #12.
  if (pendingInvite) {
    try {
      await updateDoc(doc(db, 'organizations', pendingInvite.organizationId), {
        seatCount: increment(1),
      });
    } catch (err) {
      console.warn('orgBootstrap: seat count increment failed; user joined regardless', err);
    }
  }
}
