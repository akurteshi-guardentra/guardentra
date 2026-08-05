# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single Node.js/TypeScript web service: a React 19 + Vite SPA and an
Express API served from **one process on port 8080**. `npm run dev` (`tsx server.ts`)
attaches Vite as middleware in non-production, so the frontend and `/api/*` are on the
same origin/port — there is no separate frontend dev server. Standard commands live in
`package.json` `scripts` and `.github/workflows/ci.yml`; the notes below are only the
non-obvious caveats.

### Run / lint / test / build

| Task | Command | Notes |
|------|---------|-------|
| Dev server | `npm run dev` | React SPA + API on `http://localhost:8080`. Health: `GET /api/health`. |
| Lint / typecheck | `npm run lint` | This is `tsc --noEmit` — there is no ESLint. |
| Unit tests (Node) | `npm test` | Jest (`app.test.js`), runs via `--experimental-vm-modules`. |
| Unit tests (client) | `npm run test:vitest` | Vitest + jsdom over `src/tests/**`. |
| Production build | `npm run build` | Vite client bundle + esbuild → `dist/server.cjs`. `npm start` runs the built server (production mode serves static `dist/`, no Vite). |

CI (`.github/workflows/ci.yml`) runs only `npm ci` → lint → jest → vitest. It does not
run the emulator rules tests (`test:firestore-rules`, `test:storage-rules`) or any e2e.

### Firebase Web API key is required for the UI to render (non-obvious hard gate)

`src/firebase.ts` **throws at module load** unless a Web API key with the shape
`AIza…` (>20 chars) is present via `VITE_FIREBASE_API_KEY` (or `firebase-applet-config.json`,
whose `apiKey` is intentionally empty). Because `AuthProvider`/`db` are imported by
`src/App.tsx`, a missing key makes the **entire SPA blank** (only `/api/*` still works).

- A gitignored `.env.local` in this repo sets a **placeholder** `VITE_FIREBASE_API_KEY`
  (valid format only) so the SPA boots and renders the public Landing (`/`) and Login
  (`/login`) pages during sandbox work. `.env.local` is gitignored (`.env.*` except
  `.env.example`) and is NOT recreated by the update script, so recreate it if absent.
- The placeholder is **not** a working key: Firebase Auth/Firestore/Storage network
  calls fail, so login/sign-up and any auth-gated route (`/dashboard`, `/vendors`,
  `/assessments`, etc.) cannot complete. To exercise those flows you need a **real**
  `VITE_FIREBASE_API_KEY` from a Firebase project with Auth enabled (put it in
  `.env.local`; restart `npm run dev` because Vite reads `VITE_*` at server start).

### Dev-mode conveniences worth knowing

- In non-production (`APP_ENV`/`NODE_ENV` not `production`/`staging`),
  `server/middleware/requireFirebaseAuth.ts` lets `/api/ai` and `/api/notify` through
  **without a Bearer token**, so backend endpoints are directly curl-able locally.
- The app is designed to degrade gracefully without external keys:
  - `GEMINI_API_KEY` unset → `/api/ai/*` returns realistic **mock** responses (except
    `/api/ai/generate`, which returns `503 AI not configured`).
  - `STRIPE_SECRET_KEY` unset → `/api/stripe/*` returns a clear "not configured" error.
  - `AuthContext` falls back to a local in-browser profile when Firestore is
    unreachable, but only **after** a user is authenticated.

### Ports / gotchas

- The server always binds `0.0.0.0` and prefers `process.env.PORT` (default 8080) — do
  not hardcode 3000/5000 (see `.cursorrules`).
- The Firestore **emulator** (rules tests) also defaults to port **8080** (`firebase.json`),
  colliding with the app. Don't run `npm run dev` and the emulator simultaneously.
- Node: CI and the Dockerfile target Node 20; Node 22 in this environment also runs
  lint, tests, dev server, and build without issue.
