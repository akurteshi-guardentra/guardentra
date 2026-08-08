#!/usr/bin/env node
/**
 * FastTrack Phase 2 gate runner.
 * Runs automated vitest gate suite, then prints the staging checklist.
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const vitest = spawnSync(
  'npm',
  [
    'run',
    'test:vitest',
    '--',
    'src/tests/fastTrackPhase2Gate.test.ts',
    'src/tests/orgRegion.test.ts',
    'src/tests/portalProposals.test.ts',
    'src/tests/auditCanonicalize.test.ts',
    'src/tests/frameworkPacks.test.ts',
  ],
  { stdio: 'inherit', shell: true }
);

if (vitest.status !== 0) {
  console.error('\n[e2e-gate] Automated suite FAILED — do not enable AUDIT_SPINE_ENABLED on staging.');
  process.exit(vitest.status || 1);
}

console.log(`
[e2e-gate] Automated suite PASSED.

Staging checklist (manual — see docs/FASTTRACK_PHASE2.md):
  1. Add vendor → triage Lite → send (≤20 questions) → portal evidence+attest+submit
  2. Exceptions review → decision → decision PDF → Settings → Verify chain
  3. Repeat Enhanced path; question count > Lite
  4. Tamper one hash with migrator role → verify fails
  5. Duplicate event_id → no double chain link
  6. Cross-tenant verify forbidden / EU↛US region assert (unit covered)

Only then: enable AUDIT_SPINE_ENABLED on staging; prod after staging sign-off.
`);
process.exit(0);
