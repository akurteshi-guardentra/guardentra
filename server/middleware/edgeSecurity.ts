import type { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';

/**
 * Edge security for every response: CORS allowlist (GE-07), browser security
 * headers (GE-01) and RFC 9116 security.txt (GE-06). See issue #219.
 *
 * The SPA calls /api on its own origin, the vendor portal is served from the same
 * origin, and Stripe webhooks / Cloud Tasks / Eventarc are server-to-server (no
 * browser Origin), so none of them need a cross-origin grant. Only origins listed
 * here get Access-Control-Allow-Origin; nothing ever gets "*".
 */

const DEV_ENVS = new Set(['development', 'dev', 'local', 'test', 'demo']);
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

function isDevEnv(env: NodeJS.ProcessEnv): boolean {
  // Unset means production-like, matching requireFirebaseAuth.isProductionLike.
  const v = String(env.APP_ENV || env.NODE_ENV || '').trim().toLowerCase();
  return DEV_ENVS.has(v);
}

function toOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Exact origins allowed for cross-origin /api calls. Wildcards are dropped. */
export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const origins = new Set<string>();
  const add = (value: string | undefined) => {
    const origin = value ? toOrigin(value) : null;
    if (origin) origins.add(origin);
  };
  add(env.PUBLIC_APP_URL);
  for (const entry of String(env.CORS_ALLOWED_ORIGINS || '').split(',')) add(entry);
  if (isDevEnv(env)) DEV_ORIGINS.forEach((o) => origins.add(o));
  return origins;
}

export function buildCorsMiddleware(env: NodeJS.ProcessEnv = process.env) {
  const allowed = resolveAllowedOrigins(env);
  return cors({
    // false = no CORS headers at all; the browser then blocks the cross-origin read.
    origin: (origin, callback) => callback(null, Boolean(origin && allowed.has(origin))),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Org-Id'],
    credentials: false,
    maxAge: 600,
  });
}

/** Enforced now. Narrow enough that it cannot break the SPA. */
export const ENFORCED_CSP = "base-uri 'self'; object-src 'none'; frame-ancestors 'none'";

/**
 * Full policy, Report-Only until it has been observed clean on staging (browser
 * console shows violations). Covers Firebase Auth popup, Firestore/Storage,
 * Google Fonts and remote images.
 */
export const REPORT_ONLY_CSP = [
  "default-src 'self'",
  "script-src 'self' https://apis.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // 180 days, no includeSubDomains/preload until every subdomain is HTTPS-verified.
  res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  // allow-popups keeps Firebase signInWithPopup working.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', ENFORCED_CSP);
  res.setHeader('Content-Security-Policy-Report-Only', REPORT_ONLY_CSP);
  next();
}

export const SECURITY_TXT_DEFAULT_CONTACT = 'mailto:admin@guardentra.com';
// RFC 9116 requires Expires (< 1 year recommended). Bump when it nears.
export const SECURITY_TXT_EXPIRES = '2027-10-27T00:00:00.000Z';

export function buildSecurityTxt(env: NodeJS.ProcessEnv = process.env): string {
  const contacts = String(env.SECURITY_TXT_CONTACT || SECURITY_TXT_DEFAULT_CONTACT)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const lines = contacts.map((c) => `Contact: ${c}`);
  lines.push(`Expires: ${SECURITY_TXT_EXPIRES}`);
  lines.push('Preferred-Languages: en');
  const appOrigin = env.PUBLIC_APP_URL ? toOrigin(env.PUBLIC_APP_URL) : null;
  if (appOrigin) lines.push(`Canonical: ${appOrigin}/.well-known/security.txt`);
  return `${lines.join('\n')}\n`;
}

/** Install before any route or static handler so every response is covered. */
export function applyEdgeSecurity(app: Express, env: NodeJS.ProcessEnv = process.env) {
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use('/api', buildCorsMiddleware(env));
  const body = buildSecurityTxt(env);
  app.get('/.well-known/security.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8').send(body);
  });
}

/** Unknown /api paths get JSON 404 instead of the SPA shell. Mount after all /api routes. */
export function apiNotFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}
