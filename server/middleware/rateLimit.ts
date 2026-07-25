import type { NextFunction, Request, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * Minimal in-memory fixed-window rate limiter — no new dependency required.
 * Keyed by the verified Firebase uid (set by requireFirebaseAuth) when present,
 * falling back to IP for unauthenticated dev-mode requests.
 *
 * Known limitation: per-process state. Fine for a single instance; a multi-replica
 * deployment would need a shared store (e.g. Redis) to enforce the same limit
 * across instances — not attempted here to avoid a new infra dependency.
 */
export function createRateLimiter({ windowMs, max }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref?.();

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = (req as Request & { user?: { uid?: string } }).user?.uid || req.ip || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ error: 'Too many AI requests, please slow down.' });
      return;
    }

    entry.count += 1;
    next();
  };
}
