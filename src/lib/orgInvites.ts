import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

export type OrgInviteRole = 'admin' | 'member';
export type OrgInviteStatus = 'pending' | 'accepted' | 'revoked';

export interface OrgInviteRow {
  id: string;
  organizationId: string;
  email: string;
  role: OrgInviteRole;
  status: OrgInviteStatus;
  invitedByEmail?: string;
  createdAt: string;
  acceptedAt?: string;
}

export async function createOrgInvite(input: {
  organizationId: string;
  email: string;
  role: OrgInviteRole;
  invitedByEmail?: string;
}): Promise<void> {
  await addDoc(collection(db, 'org_invites'), {
    organizationId: input.organizationId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    invitedByEmail: input.invitedByEmail,
    status: 'pending' as OrgInviteStatus,
    createdAt: new Date().toISOString(),
  });
}

/** Live list of every invite (any status) ever sent for an organization. */
export function listenOrgInvites(
  organizationId: string,
  onChange: (invites: OrgInviteRow[]) => void
): () => void {
  const q = query(collection(db, 'org_invites'), where('organizationId', '==', organizationId));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrgInviteRow));
    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    onChange(rows);
  });
}

export async function revokeOrgInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, 'org_invites', inviteId), { status: 'revoked' as OrgInviteStatus });
}
