import dotenv from 'dotenv';
import { isIsolatedLocalStartup } from '../scripts/local-demo-startup-policy.mjs';

/**
 * Side-effect module: loads env files. Must be the FIRST import in server.ts.
 *
 * This exists because of ESM evaluation order. `server/routes/ai.ts` reads
 * `process.env.GEMINI_API_KEY` at module top level (to build its GoogleGenAI client),
 * and ESM evaluates every import before any statement in the importing module — so
 * calling dotenv.config() in the body of server.ts runs *after* the routes have
 * already read a still-empty process.env. Keeping the load in its own module and
 * importing it first restores the ordering the original `import "dotenv/config"` had.
 *
 * Why not just `import "dotenv/config"`: that only reads `.env`, while `.env.example`
 * tells you to put values in `.env.local`. Server-side secrets (GEMINI_API_KEY,
 * STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) placed there per the documented setup were
 * therefore never loaded, which is why AI calls returned 503 "AI not configured" while
 * Firebase auth worked — Vite reads `.env.local` itself for the client's VITE_* vars.
 *
 * `.env.local` is read first: dotenv never overwrites an already-set variable, so the
 * first file to define a key wins. That matches Vite's precedence, and leaves real
 * environment variables — what App Hosting and Cloud Run inject — highest of all,
 * since they are set before either file is read.
 *
 * The local demo launcher sets GUARDENTRA_LOCAL_DEMO and a private state directory.
 * In that process these files are not read, so a checkout `.env` cannot put cloud
 * credentials back into the environment before routes initialize. Hosted startup
 * leaves the flag unset and keeps the file load below.
 */
if (!isIsolatedLocalStartup(process.env)) {
  dotenv.config({ path: '.env.local' });
  dotenv.config();
}
