import { collection, doc, getDocs, limit, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

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
  } else {
    const orgRef = doc(collection(db, 'organizations'));
    batch.set(orgRef, {
      name: `${fields.displayName || 'User'}'s Organization`,
      createdAt: new Date().toISOString(),
      autoCreated: true,
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
}
