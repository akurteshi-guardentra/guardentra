import type { NextFunction, Request, Response } from 'express';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { adminAppOptions } from '../lib/adminConfig.ts';

export function ensureAdmin() {
  if (getApps().length) return;
  const options = adminAppOptions();
  try {
    initializeApp({ ...options, credential: applicationDefault() });
  } catch {
    // Local/dev without ADC: token verification may fail; production must have credentials.
    initializeApp(options);
  }
}

/**
 * Fail closed: only an explicit local/dev/test environment may skip token checks.
 * Previously only 'production' | 'prod' | 'staging' enforced auth, so any other value
 * (a typo, 'prod-eu', an unset APP_ENV with NODE_ENV unset) silently disabled auth on
 * /api/ai, /api/notify and /api/audit.
 */
const AUTH_OPTIONAL_ENVS = new Set(['development', 'dev', 'local', 'test', 'demo']);
export function isProductionLike(env: NodeJS.ProcessEnv = process.env) {
  // No default: an unset environment is treated as production-like, not as local dev.
  const v = String(env.APP_ENV || env.NODE_ENV || '').trim().toLowerCase();
  return !AUTH_OPTIONAL_ENVS.has(v);
}

/**
 * Requires a Firebase ID token on Authorization: Bearer … for production/staging.
 * Non-prod may proceed without a token so local demos keep working.
 */
export async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    if (!isProductionLike()) {
      next();
      return;
    }
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    ensureAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    (req as Request & { user?: unknown }).user = decoded;
    next();
  } catch (err) {
    if (!isProductionLike()) {
      next();
      return;
    }
    console.warn('[auth] ID token verification failed', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
