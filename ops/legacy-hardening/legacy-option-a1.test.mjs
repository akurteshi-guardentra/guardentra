/**
 * Emulator tests for firestore.rules.legacy-option-a1 (guardentra-7f582 (default) ONLY).
 * Run (rules file path as arg 1; defaults to the A.1 file next to this script):
 *   npx firebase emulators:exec --only firestore --project demo-guardentra-legacy-a1 \
 *     "node legacy-option-a1.test.mjs [rulesFile]"
 * NEGATIVE cases pin the three cross-tenant write gaps (W11, W9, W10).
 * REGRESSION cases are the legitimate 7b914ee (legacy app) write shapes.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, increment, runTransaction, setDoc, updateDoc, writeBatch, getDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES = process.argv[2] || join(__dirname, 'firestore.rules.legacy-option-a1');
const A = 'orgA', B = 'orgB';
const results = { NEGATIVE: [0, 0], REGRESSION: [0, 0] };
let group = 'REGRESSION';

let reseed = null; // NEGATIVE cases each start from fresh seed data (order-independent)
async function check(label, fn) {
  if (group === 'NEGATIVE' && reseed) await reseed();
  try { await fn(); results[group][0]++; console.log(`  PASS  ${label}`); }
  catch (err) { results[group][1]++; console.error(`  FAIL  ${label}\n        ${String(err?.message || err).split('\n')[0]}`); }
}
const starterOrg = (name, extra = {}) => ({ name, dataRegion: 'us', planId: 'starter', vendorCount: 1, vendorCap: 25, seatCount: 2, seatCap: 3, subscriptionStatus: 'none', ...extra });
const now = () => new Date().toISOString();
const W9_COLLECTIONS = ['risks', 'incidents', 'compliance', 'connectors', 'policies', 'vendors', 'audit_readiness',
  'executive_reports', 'calendar_events', 'identities', 'evidence_reviews', 'remediations'];

async function main() {
  const env = await initializeTestEnvironment({
    projectId: 'demo-guardentra-legacy-a1',
    firestore: { rules: readFileSync(RULES, 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  const as = (uid, claims = {}) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true, ...claims }).firestore();

  async function seed() {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await setDoc(doc(db, 'users/adminA'), { organizationId: A, role: 'admin' });
      await setDoc(doc(db, 'users/memberA'), { organizationId: A, role: 'member' });
      await setDoc(doc(db, 'users/adminB'), { organizationId: B, role: 'admin' });
      await setDoc(doc(db, `organizations/${A}`), starterOrg('Acme'));
      await setDoc(doc(db, `organizations/${B}`), starterOrg('Bad Co'));
      await setDoc(doc(db, 'vendors/vA'), { organizationId: A, name: 'Vendor A' });
      await setDoc(doc(db, 'vendors/vA2'), { organizationId: A, name: 'Vendor A2' });
      await setDoc(doc(db, 'vendors/vB'), { organizationId: B, name: 'Vendor B' });
      await setDoc(doc(db, 'assessments/asmA'), { organizationId: A, vendorId: 'vA', status: 'Sent', portalOpen: true, sentAt: now(), questions: [{ id: 'q1' }] });
      await setDoc(doc(db, 'assessments/asmB'), { organizationId: B, vendorId: 'vB', status: 'Sent', portalOpen: true });
      await setDoc(doc(db, 'evidence/evA'), { organizationId: A, assessmentId: 'asmA', name: 'soc2.pdf' });
      await setDoc(doc(db, 'assessment_responses/respA'), { organizationId: A, assessmentId: 'asmA', answer: 'yes' });
      await setDoc(doc(db, 'vendor_assessments/vaA'), { organizationId: A, vendorId: 'vA', score: 70 });
      for (const c2 of W9_COLLECTIONS) if (c2 !== 'vendors') await setDoc(doc(db, `${c2}/docA`), { organizationId: A, title: 'x', name: 'x' });
    });
  }

  // ---------------- NEGATIVE: cross-tenant writes must be denied ----------------
  group = 'NEGATIVE';
  reseed = seed;
  console.log('NEGATIVE (cross-tenant writes, must be DENIED)');
  await seed();
  const bad = as('adminB');
  await check('W11 evidence create into another org is denied', () =>
    assertFails(setDoc(doc(bad, 'evidence/x1'), { organizationId: A, assessmentId: 'asmA', name: 'fake.pdf' })));
  await check('W11 assessment_responses create into another org is denied', () =>
    assertFails(setDoc(doc(bad, 'assessment_responses/x1'), { organizationId: A, assessmentId: 'asmA', answer: 'forged' })));
  await check('W11 evidence create by a user with no profile is denied', () =>
    assertFails(setDoc(doc(as('stranger'), 'evidence/x2'), { organizationId: A, name: 'fake.pdf' })));
  await check('W11/W10 evidence in own org pointing at another org\'s assessment is denied', () =>
    assertFails(setDoc(doc(bad, 'evidence/x3'), { organizationId: B, assessmentId: 'asmA', name: 'fake.pdf' })));
  await check('W11/W10 assessment_responses in own org pointing at another org\'s assessment is denied', () =>
    assertFails(setDoc(doc(bad, 'assessment_responses/x3'), { organizationId: B, assessmentId: 'asmA', answer: 'x' })));
  const memA = as('memberA');
  for (const c2 of W9_COLLECTIONS) {
    const id = c2 === 'vendors' ? 'vA' : 'docA';
    await check(`W9 ${c2} update moving organizationId to another org is denied`, () =>
      assertFails(updateDoc(doc(memA, `${c2}/${id}`), { organizationId: B })));
  }
  await check('W9 vendor_assessments update moving organizationId is denied', () =>
    assertFails(updateDoc(doc(memA, 'vendor_assessments/vaA'), { organizationId: B })));
  await check('W9 assessments update moving organizationId is denied', () =>
    assertFails(updateDoc(doc(memA, 'assessments/asmA'), { organizationId: B })));
  await check('W9 evidence update moving organizationId is denied', () =>
    assertFails(updateDoc(doc(memA, 'evidence/evA'), { organizationId: B })));
  await check('W9 assessment_responses update moving organizationId is denied', () =>
    assertFails(updateDoc(doc(memA, 'assessment_responses/respA'), { organizationId: B })));
  await check('W10 assessment create linked to another org\'s vendor is denied', () =>
    assertFails(setDoc(doc(memA, 'assessments/n1'), { organizationId: A, vendorId: 'vB', status: 'Sent' })));
  await check('W10 assessment create linked to a non-existent vendor is denied', () =>
    assertFails(setDoc(doc(memA, 'assessments/n2'), { organizationId: A, vendorId: 'ghost', status: 'Sent' })));
  await check('W10 assessment update re-parenting vendorId to another org\'s vendor is denied', () =>
    assertFails(updateDoc(doc(memA, 'assessments/asmA'), { vendorId: 'vB' })));
  await check('W10 assessment update re-parenting vendorId inside own org is denied', () =>
    assertFails(updateDoc(doc(memA, 'assessments/asmA'), { vendorId: 'vA2' })));
  await check('W10 vendor_assessments create linked to another org\'s vendor is denied', () =>
    assertFails(setDoc(doc(memA, 'vendor_assessments/n1'), { organizationId: A, vendorId: 'vB', score: 1 })));
  await check('W10 evidence update re-parenting assessmentId is denied', () =>
    assertFails(updateDoc(doc(memA, 'evidence/evA'), { assessmentId: 'asmB' })));
  await check('W10 assessment_responses update re-parenting assessmentId is denied', () =>
    assertFails(updateDoc(doc(memA, 'assessment_responses/respA'), { assessmentId: 'asmB' })));

  // ---------------- REGRESSION: legitimate 7b914ee workflows ----------------
  group = 'REGRESSION';
  console.log('\nREGRESSION (legitimate 7b914ee workflows, must SUCCEED)');
  await seed();
  await check('founder signup batch (7b914ee orgBootstrap shape)', async () => {
    const db = as('founder1'); const b = writeBatch(db);
    b.set(doc(db, 'organizations/newOrg'), starterOrg("F's Organization", { vendorCount: 0, seatCount: 1 }));
    b.set(doc(db, 'users/founder1'), { email: 'founder1@example.com', role: 'admin', organizationId: 'newOrg', onboarded: true, createdAt: now() });
    await assertSucceeds(b.commit());
  });
  await check('invite join with inviteId (7b914ee shape)', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'org_invites/inv1'), { organizationId: A, email: 'joiner@example.com', status: 'pending', role: 'member' }));
    const db = as('joiner'); const b = writeBatch(db);
    b.set(doc(db, 'users/joiner'), { email: 'joiner@example.com', role: 'member', organizationId: A, inviteId: 'inv1', onboarded: true });
    b.update(doc(db, 'org_invites/inv1'), { status: 'accepted', acceptedByUid: 'joiner', acceptedAt: now() });
    await assertSucceeds(b.commit());
  });
  await check('vendor create + vendorCount increment in one transaction (VendorsDirectory)', () =>
    assertSucceeds(runTransaction(memA, async (tx) => {
      const org = await tx.get(doc(memA, `organizations/${A}`));
      tx.set(doc(memA, 'vendors/vNew'), { organizationId: A, name: 'New Vendor', criticality: 'High', riskScore: 40 });
      tx.update(org.ref, { vendorCount: increment(1) });
    })));
  await check('sample seed batch: vendors + risks + policies + org marker (admin)', async () => {
    const db = as('adminA'); const b = writeBatch(db);
    b.set(doc(db, 'vendors/sample_v1'), { organizationId: A, name: 'Sample Vendor' });
    b.set(doc(db, 'risks/sample_r1'), { organizationId: A, title: 'Sample risk', impact: 3, likelihood: 2 });
    b.set(doc(db, 'policies/sample_p1'), { organizationId: A, title: 'Sample policy' });
    b.set(doc(db, `organizations/${A}`), { sampleSeedVersion: 'v1', sampleSeededAt: now() }, { merge: true });
    await assertSucceeds(b.commit());
  });
  for (const c2 of W9_COLLECTIONS) {
    const id = c2 === 'vendors' ? 'vA' : 'docA';
    await check(`${c2} member update in own org (no org move)`, () =>
      assertSucceeds(updateDoc(doc(memA, `${c2}/${id}`), { status: 'Updated' })));
  }
  await check('assessment create from wizard with own vendor (buildCreateAssessmentFields shape)', () =>
    assertSucceeds(setDoc(doc(memA, 'assessments/wiz1'), { organizationId: A, vendorId: 'vA', vendorName: 'Vendor A', frameworks: ['soc2'],
      status: 'Sent', dueAt: now(), dueDate: '2026-12-01', progressPct: 0, progress: 0, questionCount: 1, questions: [{ id: 'q1' }],
      portalOpen: true, createdAt: now(), sentAt: now() })));
  await check('assessment create in same batch as its new vendor', async () => {
    const b = writeBatch(memA);
    b.set(doc(memA, 'vendors/vBatch'), { organizationId: A, name: 'Batch Vendor' });
    b.set(doc(memA, 'assessments/asmBatch'), { organizationId: A, vendorId: 'vBatch', status: 'Draft' });
    await assertSucceeds(b.commit());
  });
  await check('assessment create without vendorId', () =>
    assertSucceeds(setDoc(doc(memA, 'assessments/noVendor'), { organizationId: A, status: 'Draft' })));
  await check('member assessment update (due date / reminder) in own org', () =>
    assertSucceeds(updateDoc(doc(memA, 'assessments/asmA'), { dueAt: now(), reminderScheduleId: 'standard' })));
  await check('vendor_assessments create with own vendor (VendorRisk AI scan)', () =>
    assertSucceeds(setDoc(doc(memA, 'vendor_assessments/va2'), { organizationId: A, vendorId: 'vA', type: 'Regulatory Scorecard', score: 72, createdAt: now() })));
  await check('vendor_assessments member update in own org', () =>
    assertSucceeds(updateDoc(doc(memA, 'vendor_assessments/vaA'), { score: 75 })));
  await check('vendor_triage create + update (vendorTriageStore)', async () => {
    await assertSucceeds(setDoc(doc(memA, 'vendor_triage/vA'), { organizationId: A, vendorId: 'vA', tier: 'Lite' }));
    await assertSucceeds(updateDoc(doc(memA, 'vendor_triage/vA'), { tier: 'Standard' }));
  });
  await check('vendor_invites create (VendorsDirectory Invite Vendor)', () =>
    assertSucceeds(setDoc(doc(memA, 'vendor_invites/vi1'), { organizationId: A, vendorId: 'vA', email: 'v@example.com', invitedBy: 'memberA', createdAt: now() })));
  const portal = as('portal-anon', { portalAssessmentId: 'asmA' });
  await check('vendor portal autosave (buildPortalAutosavePatch fields)', () =>
    assertSucceeds(updateDoc(doc(portal, 'assessments/asmA'), { answers: { q1: 'yes' }, comments: {}, evidenceByQuestion: {}, progressPct: 50, progress: 50, answerProposals: {} })));
  await check('vendor portal submit (buildPortalSubmitPatch fields)', () =>
    assertSucceeds(updateDoc(doc(portal, 'assessments/asmA'), { answers: { q1: 'yes' }, comments: {}, evidenceByQuestion: {}, progressPct: 100, progress: 100,
      status: 'Under Review', completedAt: now(), portalOpen: false, submittedSnapshot: { answers: { q1: 'yes' } }, versionLocked: true })));
  await check('portal session reads its submitted assessment', () => assertSucceeds(getDoc(doc(portal, 'assessments/asmA'))));
  await check('evidence create in own org for own assessment', () =>
    assertSucceeds(setDoc(doc(memA, 'evidence/ok1'), { organizationId: A, assessmentId: 'asmA', name: 'iso.pdf' })));
  await check('evidence create in own org without assessmentId', () =>
    assertSucceeds(setDoc(doc(memA, 'evidence/ok2'), { organizationId: A, name: 'policy.pdf' })));
  await check('assessment_responses create in own org for own assessment', () =>
    assertSucceeds(setDoc(doc(memA, 'assessment_responses/ok1'), { organizationId: A, assessmentId: 'asmA', answer: 'yes' })));
  await check('evidence / assessment_responses member update in own org', async () => {
    await assertSucceeds(updateDoc(doc(memA, 'evidence/evA'), { name: 'soc2-v2.pdf' }));
    await assertSucceeds(updateDoc(doc(memA, 'assessment_responses/respA'), { answer: 'no' }));
  });
  await check('admin updates org settings (name)', () =>
    assertSucceeds(updateDoc(doc(as('adminA'), `organizations/${A}`), { name: 'Acme 2' })));

  await env.cleanup();
  const [np, nf] = results.NEGATIVE, [rp, rf] = results.REGRESSION;
  console.log(`\nRULES ${RULES}\nNEGATIVE ${np} pass / ${nf} fail; REGRESSION ${rp} pass / ${rf} fail`);
  process.exit(nf || rf ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
