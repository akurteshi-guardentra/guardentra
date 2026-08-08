# FastTrack + Phase 2 — source of truth

Product FastTrack (training guide) is the user journey. Phase 2 is the security/evidence spine that wraps every material state change. Diagram “100% alignment” means architectural compatibility, not “already shipped.”

**Naming:** This is product Phase 2 (audit spine). Unrelated: billing “Phase 2” in `docs/ACCOUNT_MIGRATION.md`.

## Layers

| Layer | Store | Responsibility |
|-------|--------|----------------|
| Product / FastTrack | Firestore | Vendors, triage, assessments, portal, decisions |
| Phase 2 security | PostgreSQL audit DB | Append-only events, SHA-256 chain, verify/export |

Connection: every material product transition emits a durable audit intent (`POST /api/audit/emit` → outbox → worker → events + hash chain).

Security boundary: client never chooses region, never computes hashes, never decides evidence ACL.

## Canonical stages

1. **Add vendor** → 2. **Triage** (Lite/Standard/Enhanced) → 3. **Build & send** → 4. **Vendor portal** → 5. **Review & decide** → 6. **Monitor + verify**

## Gap matrix (repo vs training)

| Stage | Product today | Phase 2 today |
|-------|---------------|---------------|
| S1 Add vendor | Mostly OK | Emit wired when spine enabled |
| S2 Triage | Persist + Lite/Standard/Enhanced cap (max 20/50/100) | `triage.completed` emit |
| S3 Build & send | Wizard + portal link; created/sent emits on create | Reminder schedule + sent-version lock still thin |
| S4 Portal | Q&A + evidence; no AI proposals/attestations | submit/evidence emit; attestations TBD |
| S5 Review | Exceptions + 4 decisions | decision.finalized emit TBD |
| S6 Monitor/verify | Thin nextReview / reports | verify + export APIs (UI TBD) |

## Event catalog

`vendor.created` · `vendor.imported` · `vendor.invite_queued` · `triage.completed` · `assessment.created` · `assessment.sent` · `answer.saved` · `evidence.uploaded` · `assessment.submitted` · `decision.finalized` · `audit.chain_verified`

Payloads are redacted (no secrets, tokens, full document bodies).

## Local audit DB

```bash
docker compose -f docker-compose.audit.yml up -d
npm run migrate:audit
# .env.local:
AUDIT_SPINE_ENABLED=true
AUDIT_DATABASE_URL=postgres://audit_app:audit_app@localhost:5433/guardentra_audit
AUDIT_DATABASE_URL_MIGRATOR=postgres://audit_migrator:audit_migrator@localhost:5433/guardentra_audit
AUDIT_WORKER_ENABLED=true
```

When `AUDIT_SPINE_ENABLED` is false (default), emit APIs no-op safely so App Hosting without Cloud SQL still boots.

## APIs

- `POST /api/audit/emit` — queue outbox row (auth)
- `GET /api/audit/verify?tenantId=` — recompute SHA-256 chain
- `GET /api/audit/export?tenantId=&format=json|csv` — export redacted trail

## Tamper test (manual / staging)

With audit spine enabled and at least one event in the chain:

1. As migrator role, `UPDATE audit_hash_chain SET hash = 'deadbeef' WHERE seq = 1;`
2. `GET /api/audit/verify?tenantId=<org>` must return a failure (`ok: false` / broken).
3. Restore from backup or re-seed; duplicate `event_id` emit must not double-link.

## P2B regional isolation

Preparatory work is in-repo; dual Firebase projects are still required before live residency routing.

| Piece | Status |
|-------|--------|
| `organizations.dataRegion` (`eu`\|`us`) | Set on org create (`us` default); immutable in Firestore rules |
| Settings one-time pin | [`DataRegionCard`](../src/components/DataRegionCard.tsx) when unset |
| Server registry | [`server/lib/regionRouter.ts`](../server/lib/regionRouter.ts) — trusted org region only |
| Isolation tests | `assertRegionIsolation('eu','us')` fails (vitest) |
| Live dual projects | Blocked until paid `guardentra-eu` / `guardentra-us` (or equivalent) exist |

Env (when dual projects exist): `FIREBASE_PROJECT_ID_EU`, `FIREBASE_PROJECT_ID_US`, `FIREBASE_STORAGE_BUCKET_EU`, `FIREBASE_STORAGE_BUCKET_US`.

## E2E gate checklist

Automated (local):

```bash
npm run test:e2e-gate
```

Covers Lite vs Enhanced depth, attestations/proposals, decision packet HTML, hash-chain tamper (pure), idempotent event id, EU↛US isolation.

Staging (manual after automated green):

1. Add vendor → triage Lite → wizard shows ≤20 questions → send with due + reminders → portal evidence + attest + submit → exceptions review → decision → decision PDF → Settings verify chain.
2. Repeat Enhanced path; question count differs.
3. Tamper one hash with migrator role → verify fails.
4. Duplicate `event_id` → no double chain link.
5. Enable `AUDIT_SPINE_ENABLED` on staging only after gate; prod after staging sign-off.
