import type { NextFunction, Request, Response } from 'express';
import { getApps } from 'firebase-admin/app';
import { getAdminDb } from '../lib/adminDb.ts';
import { INVITE_SEAT_UNCLAIMED_MESSAGE, inviteSeatUnclaimed } from '../lib/inviteSeat.ts';
import { ensureAdmin, isProductionLike } from './requireFirebaseAuth.ts';

export const AI_MEMBERSHIP_REQUIRED_MESSAGE = 'Organization membership required.';

export type InviteSeatCaller = {
  uid?: string;
  portalAssessmentId?: unknown;
};

export type InviteSeatProfileLoader = (uid: string) => Promise<object | null | undefined>;

function profileOrganizationId(profile: object): string {
  const value = (profile as { organizationId?: unknown }).organizationId;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Signed-in /api/ai calls spend the model and can read tenant analysis.
 * Firestore rules do not run on the Admin SDK, so an invite left at
 * `seatCountApplied: false` must be refused here. A profile that omits the
 * marker stays a member when it names an organization. A signed-in caller
 * with no user profile, or a profile with no organization id, is not a
 * member and is refused outside local demos. A vendor portal token is scoped
 * to one assessment and is not an org seat.
 */
export function createRequireClaimedInviteSeat(
  loadProfile: InviteSeatProfileLoader,
  env: () => NodeJS.ProcessEnv = () => process.env,
) {
  return async function requireClaimedInviteSeat(req: Request, res: Response, next: NextFunction) {
    const user = (req as Request & { user?: InviteSeatCaller }).user;
    const portalAssessmentId = user?.portalAssessmentId;
    if (typeof portalAssessmentId === 'string' && portalAssessmentId.trim() !== '') {
      next();
      return;
    }

    const uid = typeof user?.uid === 'string' ? user.uid.trim() : '';
    if (!uid) {
      if (isProductionLike(env())) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      next();
      return;
    }

    try {
      const profile = await loadProfile(uid);
      if (profile == null) {
        if (isProductionLike(env())) {
          res.status(403).json({ error: AI_MEMBERSHIP_REQUIRED_MESSAGE });
          return;
        }
        next();
        return;
      }
      if (inviteSeatUnclaimed(profile)) {
        res.status(403).json({ error: INVITE_SEAT_UNCLAIMED_MESSAGE });
        return;
      }
      if (profileOrganizationId(profile) === '') {
        if (isProductionLike(env())) {
          res.status(403).json({ error: AI_MEMBERSHIP_REQUIRED_MESSAGE });
          return;
        }
        next();
        return;
      }
      next();
    } catch (err) {
      if (!isProductionLike(env())) {
        next();
        return;
      }
      console.warn('[ai] invite seat check failed', err);
      res.status(503).json({ error: 'Could not verify invite seat.' });
    }
  };
}

export async function loadInviteSeatProfile(uid: string): Promise<object | null> {
  if (getApps().length === 0) {
    if (!isProductionLike()) return null;
    ensureAdmin();
  }
  const snap = await getAdminDb().collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return snap.data() || {};
}

export const requireClaimedInviteSeat = createRequireClaimedInviteSeat(loadInviteSeatProfile);
