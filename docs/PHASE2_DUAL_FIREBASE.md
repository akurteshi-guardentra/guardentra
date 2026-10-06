# Dual Firebase EU / US — GATED ROADMAP CAPABILITY

Prep code exists for regional routing (`organizations.dataRegion`,
`server/lib/regionRouter.ts`), but repository code is not proof that separate residency
projects exist or are ready for customer traffic.

## Current environment truth

- named staging: `guardentra-staging`
- named production: `guardentra-prod`
- `guardentra-7f582`: demo / legacy / rollback-history context pending #126
- EU/US residency projects: **UNVERIFIED until a fresh #116 read-only inventory proves them**

The 2026-08-11 status that only `guardentra-7f582` was visible and that staging/prod did
not exist is historical and must not be reused.

## Before any residency project work

1. Collect current #116 cloud inventory and record whether the intended EU/US projects
   exist, their parent/billing attachment and non-secret environment identity.
2. Use a fresh issue-bound task for project creation, Firebase enablement, billing, IAM,
   App Hosting, rules, or data migration.
3. Never infer project-create permission from organization roles or retry historical
   creation commands from git history.
4. Never reuse staging/prod credentials, Auth, Firestore or Storage across residency
   environments merely to make a test pass.

## Intended wiring after separately approved provisioning

The server design expects explicit environment configuration for regional Firebase project
and storage identities. Values must come from the actual provisioned projects, not from
this document or a copied historical example.

## Acceptance before enabling dual routing

- exact project IDs and regions are read back live;
- Firebase Auth/Firestore/Storage are configured per residency environment;
- cross-region isolation tests fail closed for unauthorized EU↔US reads/writes;
- deployment/source SHA and rollback are recorded;
- no staging/production tenant is silently moved between projects;
- evidence remains environment- and source-bound.

Until those gates pass, dual routing stays prep-only.

Issue #138 tracks the removal of stale environment assumptions from this roadmap guide.
