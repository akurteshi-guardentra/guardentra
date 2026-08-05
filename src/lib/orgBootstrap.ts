import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

/** Starter-tier seat allowance (docs/ARCHITECTURE_FOUNDATION.md §4). Growth raises it to 10. */
export const DEFAULT_SEAT_CAP = 3;

interface NewProfileFields {
  email: string | null;
  displayName: string;
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
 */
export async function bootstrapUserProfile(uid: string, fields: NewProfileFields): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const email = (fields.email || '').trim().toLowerCase();

  let pendingInvite: { id: string; organizationId: string; role?: string } | null = null;
  if (email) {
    // Invite lookup must never block account creation. Rules require the query
    // email to equal request.auth.token.email exactly — casing mismatches or
    // transient permission errors used to reject the entire bootstrap and leave
    // first-run users on a local-only profile (blank/skipped onboarding).
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
      console.warn('orgBootstrap: pending-invite lookup failed; creating a new org instead', inviteErr);
      pendingInvite = null;
    }
  }

  const batch = writeBatch(db);

  if (pendingInvite) {
    batch.set(userRef, {
      email: fields.email,
      displayName: fields.displayName,
      role: pendingInvite.role || 'member',
      organizationId: pendingInvite.organizationId,
      onboarded: false,
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
    batch.set(orgRef, {
      name: `${fields.displayName || 'User'}'s Organization`,
      createdAt: new Date().toISOString(),
      autoCreated: true,
      // The creator occupies the first seat.
      seatCount: 1,
      seatCap: DEFAULT_SEAT_CAP,
    });
    batch.set(userRef, {
      email: fields.email,
      displayName: fields.displayName,
      role: 'admin',
      organizationId: orgRef.id,
      onboarded: false,
      createdAt: new Date().toISOString(),
    });
  }

  await batch.commit();

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
