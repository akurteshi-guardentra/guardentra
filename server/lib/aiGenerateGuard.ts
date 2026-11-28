import type { NextFunction, Request, Response } from 'express';
import { createRateLimiter } from '../middleware/rateLimit';
import { isProductionLike } from '../middleware/requireFirebaseAuth';

/** Shared ceiling for POST /api/ai/generate. Seats in one org share this window. */
export const AI_GENERATE_ORG_WINDOW_MS = 60_000;
export const AI_GENERATE_ORG_MAX = 30;
export const AI_GENERATE_ORG_LIMIT_MESSAGE =
  'Too many AI requests for this organization, please slow down.';
export const AI_GENERATE_ORG_REQUIRED_MESSAGE = 'Organization membership required.';
export const AI_GENERATE_ORG_UNAVAILABLE_MESSAGE =
  'Could not verify organization for this AI request.';

const trustedOrganization = new WeakMap<Request, string>();

export type GenerateProfileLoader = (uid: string) => Promise<object | null | undefined>;

/** Only a string organization id from the server-side user profile counts. */
export function organizationIdFromProfile(profile: object | null | undefined): string {
  if (!profile || typeof profile !== 'object') return '';
  const value = (profile as { organizationId?: unknown }).organizationId;
  return typeof value === 'string' ? value.trim() : '';
}

export function aiGenerateOrgKey(req: Request): string {
  const organizationId = trustedOrganization.get(req)?.trim() || '';
  return organizationId ? `org:${organizationId}` : '';
}

function rememberTrustedOrganization(req: Request, organizationId: string) {
  trustedOrganization.set(req, organizationId);
}

/**
 * Resolve the caller's organization from users/{uid} before the generate limiter.
 * Client X-Org-Id and body.organizationId are ignored: those used to mint a fresh
 * budget on every request. Production refuses the Gemini call when the org cannot
 * be resolved, so a failed lookup cannot skip the shared cap.
 */
export function createResolveGenerateOrganization(
  loadProfile: GenerateProfileLoader,
  env: () => NodeJS.ProcessEnv = () => process.env,
) {
  return async function resolveGenerateOrganization(req: Request, res: Response, next: NextFunction) {
    const uidValue = (req as Request & { user?: { uid?: unknown } }).user?.uid;
    const uid = typeof uidValue === 'string' ? uidValue.trim() : '';
    if (!uid) {
      if (isProductionLike(env())) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      next();
      return;
    }

    try {
      const organizationId = organizationIdFromProfile(await loadProfile(uid));
      if (!organizationId) {
        if (isProductionLike(env())) {
          res.status(403).json({ error: AI_GENERATE_ORG_REQUIRED_MESSAGE });
          return;
        }
        next();
        return;
      }
      rememberTrustedOrganization(req, organizationId);
      next();
    } catch (err) {
      if (!isProductionLike(env())) {
        next();
        return;
      }
      console.warn('[ai] organization limit lookup failed', err);
      res.status(503).json({ error: AI_GENERATE_ORG_UNAVAILABLE_MESSAGE });
    }
  };
}

export function createAiGenerateOrgLimiter() {
  const limit = createRateLimiter({
    windowMs: AI_GENERATE_ORG_WINDOW_MS,
    max: AI_GENERATE_ORG_MAX,
    errorMessage: AI_GENERATE_ORG_LIMIT_MESSAGE,
    keyFn: aiGenerateOrgKey,
  });
  return function aiGenerateOrgLimit(req: Request, res: Response, next: NextFunction) {
    return limit(req, res, next);
  };
}
