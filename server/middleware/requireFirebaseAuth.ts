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

function isProductionLike() {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  return env === 'production' || env === 'prod' || env === 'staging';
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
