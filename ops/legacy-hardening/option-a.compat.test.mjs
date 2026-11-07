/**
 * Option A compatibility suite (copied from PR #228 ops/emergency-rules), run here against the A.1 file.
 * Run: npx firebase emulators:exec --only firestore --project demo-guardentra-option-a \
 *        "node ops/legacy-hardening/option-a.compat.test.mjs [rulesFile]"
 *
 * Mostly compatibility: the writes the deployed apps actually make (prod 29171a6,
 * legacy 7b914ee, see src/lib/orgBootstrap.ts at those commits) must keep working.
 * A few cases pin the three fixed gaps and the accepted invite-join break.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
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

const starterOrg = (name) => ({
  name, createdAt: new Date().toISOString(), autoCreated: true, dataRegion: 'us',
  planId: 'starter', vendorCount: 0, vendorCap: 25, seatCount: 1, seatCap: 3, subscriptionStatus: 'none',
});

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-guardentra-option-a',
    firestore: {
      rules: readFileSync(process.argv[2] || join(__dirname, 'firestore.rules.legacy-option-a1'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  async function seed() {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin-1'), { organizationId: ORG, role: 'admin', email: 'a@example.com' });
      await setDoc(doc(db, 'users/member-1'), { organizationId: ORG, role: 'member', email: 'm@example.com' });
      await setDoc(doc(db, `organizations/${ORG}`), { ...starterOrg('Acme'), seatCount: 2 });
      await setDoc(doc(db, 'org_invites/inv1'), { organizationId: ORG, email: 'new@example.com', status: 'pending', role: 'member' });
    });
  }

  const ctx = (uid, email, verified = true) =>
    testEnv.authenticatedContext(uid, { email, email_verified: verified }).firestore();

  console.log('Compatibility with deployed clients');
  await seed();

  await check('founder signup batch (29171a6 shape) succeeds', async () => {
    const db = ctx('founder-1', 'f1@example.com');
    const b = writeBatch(db);
    b.set(doc(db, 'organizations/neworg1'), starterOrg("F1's Organization"));
    b.set(doc(db, 'users/founder-1'), {
      email: 'f1@example.com', displayName: 'F1', role: 'admin', organizationId: 'neworg1',
      onboarded: false, createdAt: new Date().toISOString(),
    });
    await assertSucceeds(b.commit());
  });

  await check('founder signup batch (7b914ee shape) succeeds', async () => {
    const db = ctx('founder-2', 'f2@example.com');
    const b = writeBatch(db);
    b.set(doc(db, 'organizations/neworg2'), starterOrg("F2's Organization"));
    b.set(doc(db, 'users/founder-2'), {
      email: 'f2@example.com', displayName: 'F2', role: 'admin', organizationId: 'neworg2',
      onboarded: true, createdAt: new Date().toISOString(),
    });
    await assertSucceeds(b.commit());
  });

  await check('invite join with inviteId (7b914ee shape) succeeds', async () => {
    const db = ctx('joiner-1', 'new@example.com');
    const b = writeBatch(db);
    b.set(doc(db, 'users/joiner-1'), {
      email: 'new@example.com', displayName: 'J', role: 'member', organizationId: ORG,
      inviteId: 'inv1', onboarded: true, createdAt: new Date().toISOString(),
    });
    b.update(doc(db, 'org_invites/inv1'), {
      status: 'accepted', acceptedByUid: 'joiner-1', acceptedAt: new Date().toISOString(),
    });
    await assertSucceeds(b.commit());
  });

  await check('joined member seatCount increment succeeds', async () => {
    await assertSucceeds(updateDoc(doc(ctx('joiner-1', 'new@example.com'), `organizations/${ORG}`), { seatCount: increment(1) }));
  });

  await check('admin updates org name/logo succeeds', async () => {
    await assertSucceeds(updateDoc(doc(ctx('admin-1', 'a@example.com'), `organizations/${ORG}`), { name: 'Acme 2', logoUrl: 'https://example.com/l.png' }));
  });

  await check('member vendor create succeeds', async () => {
    await assertSucceeds(setDoc(doc(ctx('member-1', 'm@example.com'), 'vendors/v1'), { name: 'Vendor 1', organizationId: ORG }));
  });

  await check('member vendorCount increment succeeds', async () => {
    await assertSucceeds(updateDoc(doc(ctx('member-1', 'm@example.com'), `organizations/${ORG}`), { vendorCount: increment(1) }));
  });

  console.log('\nFixed gaps');
  await seed();

  await check('admin billing-field update is denied', async () => {
    await assertFails(updateDoc(doc(ctx('admin-1', 'a@example.com'), `organizations/${ORG}`), { planId: 'growth' }));
  });

  await check('org create with non-starter caps is denied', async () => {
    const db = ctx('founder-3', 'f3@example.com');
    const b = writeBatch(db);
    b.set(doc(db, 'organizations/neworg3'), { ...starterOrg('F3'), vendorCap: 1000 });
    b.set(doc(db, 'users/founder-3'), { email: 'f3@example.com', role: 'admin', organizationId: 'neworg3' });
    await assertFails(b.commit());
  });

  await check('org create without a matching founder profile is denied', async () => {
    await assertFails(setDoc(doc(ctx('founder-4', 'f4@example.com'), 'organizations/neworg4'), starterOrg('F4')));
  });

  await check('profile create naming an existing org without an invite is denied', async () => {
    await assertFails(setDoc(doc(ctx('outsider-1', 'o@example.com'), 'users/outsider-1'), { email: 'o@example.com', role: 'member', organizationId: ORG }));
  });

  await check('invite join with unverified email is denied', async () => {
    const db = ctx('joiner-2', 'new@example.com', false);
    await assertFails(setDoc(doc(db, 'users/joiner-2'), { email: 'new@example.com', role: 'member', organizationId: ORG, inviteId: 'inv1' }));
  });

  await check('invite join with a higher role than the invite is denied', async () => {
    const db = ctx('joiner-3', 'new@example.com');
    await assertFails(setDoc(doc(db, 'users/joiner-3'), { email: 'new@example.com', role: 'admin', organizationId: ORG, inviteId: 'inv1' }));
  });

  console.log('\nAccepted break');
  await check('invite join without inviteId (29171a6 shape) is denied', async () => {
    const db = ctx('joiner-4', 'new@example.com');
    await assertFails(setDoc(doc(db, 'users/joiner-4'), { email: 'new@example.com', role: 'member', organizationId: ORG }));
  });

  await testEnv.cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
