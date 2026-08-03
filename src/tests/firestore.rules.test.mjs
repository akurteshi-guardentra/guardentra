/**
 * Firestore rules unit tests for the soft field guards added in KNOWN_ISSUES #11.
 * Run via: npm run test:firestore-rules
 *
 * The point of these tests is the backward-compatibility half, not the rejection half.
 * #11 stayed open for a long time because a strict hasOnly() allowlist risked breaking
 * updates to documents already in a deployed database carrying fields this repo had
 * never seen. The guards are therefore deliberately soft, and the cases below pin that
 * down: a document with unknown extra fields must still be accepted, and a missing field
 * must still be accepted. Only a *known* field with an obviously wrong type is rejected.
 *
 * Field lists were read off the real documents in guardentra-7f582 rather than guessed.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const PROJECT_ID = 'demo-guardentra-firestore-rules';
const ORG = 'org1';

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(`        ${err?.message || err}`);
  }
}

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(join(root, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
  console.log('Rules loaded (syntax OK).\n');

  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/member-1'), { organizationId: ORG, role: 'admin' });
    await setDoc(doc(ctx.firestore(), 'users/member-2'), { organizationId: ORG, role: 'member' });
    await setDoc(doc(ctx.firestore(), 'organizations/' + ORG), {
      name: 'Acme Cybersec', industry: 'SaaS', seatCount: 2, vendorCount: 5,
    });
  });

  const db = testEnv.authenticatedContext('member-1', { email: 'm@example.com' }).firestore();
  const memberDb = testEnv.authenticatedContext('member-2', { email: 'm2@example.com' }).firestore();
  const write = (col, id, data) => setDoc(doc(db, `${col}/${id}`), { organizationId: ORG, ...data });

  console.log('Accepts real document shapes:');

  await check('risk with the real field shape', () =>
    assertSucceeds(write('risks', 'r1', {
      title: 'Unpatched host', category: 'Operational', severity: 'High',
      status: 'Open', owner: 'Security', mitigation: 'Patch', impact: 4, likelihood: 3,
      createdAt: '2026-01-01T00:00:00Z',
    })),
  );

  await check('compliance with the real field shape', () =>
    assertSucceeds(write('compliance', 'c1', {
      name: 'ISO 27001', status: 'Active', description: 'x', nextAudit: '2027-01-01', progress: 42,
    })),
  );

  await check('identity with the real field shape', () =>
    assertSucceeds(write('identities', 'i1', {
      name: 'Jane', email: 'jane@example.com', accessLevel: 'Admin',
      dataSensitivity: 'High', device: 'MacBook', riskScore: 70, deviceHealth: 90,
    })),
  );

  console.log('\nStays backward compatible — the reason #11 stayed open:');

  await check('unknown extra fields are still accepted', () =>
    assertSucceeds(write('risks', 'r2', {
      title: 'Has extras', impact: 1,
      someFutureField: 'added by a later version', anotherOne: { nested: true },
    })),
  );

  await check('a document with almost no fields is still accepted', () =>
    assertSucceeds(write('incidents', 'i2', { title: 'Sparse' })),
  );

  await check('an empty document (org only) is still accepted', () =>
    assertSucceeds(write('policies', 'p2', {})),
  );

  console.log('\nRejects a known field with an obviously wrong type:');

  await check('risk.impact as a string is rejected', () =>
    assertFails(write('risks', 'r3', { title: 'Bad', impact: 'four' })),
  );

  await check('compliance.progress as a string is rejected', () =>
    assertFails(write('compliance', 'c3', { name: 'X', progress: 'lots' })),
  );

  await check('connector.health as a string is rejected', () =>
    assertFails(write('connectors', 'k3', { name: 'X', health: 'good' })),
  );

  await check('identity.riskScore as a string is rejected', () =>
    assertFails(write('identities', 'i3', { name: 'X', riskScore: 'high' })),
  );

  await check('policy.title as a number is rejected', () =>
    assertFails(write('policies', 'p3', { title: 12345 })),
  );

  console.log('\nOrganization settings are admin-only (task #27 finding):');

  await check('admin CAN update org name/industry', () =>
    assertSucceeds(updateDoc(doc(db, 'organizations', ORG), { name: 'Renamed Co', industry: 'FinTech' })),
  );

  await check('non-admin member CANNOT update org name — the gap this fix closes', () =>
    assertFails(updateDoc(doc(memberDb, 'organizations', ORG), { name: 'Hijacked Co' })),
  );

  await check('non-admin member CAN increment vendorCount alone', () =>
    assertSucceeds(updateDoc(doc(memberDb, 'organizations', ORG), { vendorCount: 6 })),
  );

  await check('non-admin member CAN increment seatCount alone', () =>
    assertSucceeds(updateDoc(doc(memberDb, 'organizations', ORG), { seatCount: 3 })),
  );

  await check('non-admin member CANNOT smuggle name in alongside an allowed counter', () =>
    assertFails(updateDoc(doc(memberDb, 'organizations', ORG), { vendorCount: 7, name: 'Sneaky Co' })),
  );

  // Regression guard for a production bug this review uncovered. KI#13 originally put
  // the seatCount increment inside bootstrapUserProfile's batch, alongside the joining
  // member's own profile write. Rules get no read-your-writes consistency within a
  // batch, so isOrgMember(orgId) evaluated against a users/{uid} doc that did not exist
  // yet and the WHOLE batch was rejected — invited users could not join at all. The two
  // cases below pin the corrected two-step order.
  await check(
    'a batch bundling profile-create + org update is REJECTED (no read-your-writes in rules)',
    async () => {
      const joinerDb = testEnv.authenticatedContext('new-joiner', { email: 'new@example.com' }).firestore();
      const batch = writeBatch(joinerDb);
      batch.set(doc(joinerDb, 'users/new-joiner'), { organizationId: ORG, role: 'member' });
      batch.update(doc(joinerDb, 'organizations', ORG), { seatCount: 4 });
      await assertFails(batch.commit());
    },
  );

  await check(
    "orgBootstrap.ts's corrected order: profile first, then the seat increment succeeds",
    async () => {
      const joinerDb = testEnv.authenticatedContext('joiner-2', { email: 'j2@example.com' }).firestore();
      // Step 1 — the batch, profile only (invite update omitted; covered elsewhere).
      const batch = writeBatch(joinerDb);
      batch.set(doc(joinerDb, 'users/joiner-2'), { organizationId: ORG, role: 'member' });
      await assertSucceeds(batch.commit());
      // Step 2 — now that the profile exists, isOrgMember() resolves and the
      // counter-only update passes the admin-or-counters rule.
      await assertSucceeds(updateDoc(doc(joinerDb, 'organizations', ORG), { seatCount: 4 }));
    },
  );

  console.log('\nOrg scoping still holds:');

  await check('cannot write a document into another org', () =>
    assertFails(setDoc(doc(db, 'risks/r4'), { organizationId: 'someone-else', title: 'X' })),
  );

  await testEnv.cleanup();
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
