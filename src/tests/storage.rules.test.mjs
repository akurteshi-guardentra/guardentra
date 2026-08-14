/**
 * Storage rules unit tests for /portal/{assessmentId}/{fileName}.
 * Run via: npm run test:storage-rules
 * (starts Firestore + Storage emulators, then executes this file)
 *
 * Rules check the assessmentId in the Storage path against that doc's portalOpen AND
 * against a `portalAssessmentId` custom-token claim minted by server/routes/portal.ts.
 *
 * This file originally documented the absence of that bind as accepted behaviour. It is
 * no longer accepted: a session for assessment A reaching assessment B's evidence was a
 * live cross-tenant exposure (docs/KNOWN_ISSUES.md #17), confirmed in production and then
 * closed. The cases below now assert the bind, so a regression fails here rather than
 * silently reopening the hole.
 *
 * `portal(id)` builds a context carrying the claim, which is what a real vendor session
 * looks like. A bare anonymous context — no claim — must now be denied everywhere.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const PROJECT_ID = 'demo-guardentra-storage-rules';

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const pdfMeta = { contentType: 'application/pdf' };

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
  console.log('Loading storage.rules + firestore.rules into emulator test env…');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(join(root, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(join(root, 'storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
  console.log('Rules loaded (syntax OK).\n');

  await testEnv.clearFirestore();
  await testEnv.clearStorage();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'assessments/assessmentA'), {
      portalOpen: true,
      organizationId: 'org1',
    });
    // B starts closed — anonymous must not touch closed/foreign closed paths.
    await setDoc(doc(db, 'assessments/assessmentB'), {
      portalOpen: false,
      organizationId: 'org1',
    });
    // C is open — documents remaining cross-open-portal reachability.
    await setDoc(doc(db, 'assessments/assessmentC'), {
      portalOpen: true,
      organizationId: 'org1',
    });
    await setDoc(doc(db, 'users/org-member-1'), {
      organizationId: 'org1',
      role: 'admin',
    });
  });

  const anon = testEnv.authenticatedContext('anon-vendor-1', {
    firebase: { sign_in_provider: 'anonymous' },
  });
  const member = testEnv.authenticatedContext('org-member-1', {
    email: 'member@example.com',
  });
  const unauth = testEnv.unauthenticatedContext();
  // What server/routes/portal.ts actually mints: uid portal_<id> + the scoping claim.
  const portal = (assessmentId) =>
    testEnv.authenticatedContext(`portal_${assessmentId}`, {
      firebase: { sign_in_provider: 'custom' },
      portalAssessmentId: assessmentId,
    });

  console.log('Matrix:');

  await check(
    'scoped portal session CAN write its own /portal/assessmentA/... when portalOpen=true',
    async () => {
      await assertSucceeds(
        uploadBytes(
          ref(portal('assessmentA').storage(), 'portal/assessmentA/evidence-a.pdf'),
          pdfBytes,
          pdfMeta,
        ),
      );
    },
  );

  await check(
    'session for A CANNOT write evidence into another tenant assessment path',
    async () => {
      await assertFails(
        uploadBytes(
          ref(portal('assessmentA').storage(), 'portal/assessmentC/stolen.pdf'),
          pdfBytes,
          pdfMeta,
        ),
      );
    },
  );

  await check(
    'scoped portal session CAN read back its own evidence',
    async () => {
      await assertSucceeds(
        getBytes(ref(portal('assessmentA').storage(), 'portal/assessmentA/evidence-a.pdf')),
      );
    },
  );

  await check(
    'bare anonymous session (no portalAssessmentId claim) CANNOT write — KNOWN_ISSUES #17',
    async () => {
      await assertFails(
        uploadBytes(ref(anon.storage(), 'portal/assessmentA/no-claim.pdf'), pdfBytes, pdfMeta),
      );
    },
  );

  await check(
    'anonymous CANNOT write /portal/assessmentB/... when B portalOpen=false',
    async () => {
      await assertFails(
        uploadBytes(ref(anon.storage(), 'portal/assessmentB/evidence-b.pdf'), pdfBytes, pdfMeta),
      );
    },
  );

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(
      ref(ctx.storage(), 'portal/assessmentB/seeded-b.pdf'),
      pdfBytes,
      pdfMeta,
    );
  });

  await check(
    'anonymous CANNOT read /portal/assessmentB/... when B portalOpen=false',
    async () => {
      await assertFails(getBytes(ref(anon.storage(), 'portal/assessmentB/seeded-b.pdf')));
    },
  );

  await check(
    'session for A CANNOT write to also-open assessment C — the KNOWN_ISSUES #17 fix',
    async () => {
      await assertFails(
        uploadBytes(
          ref(portal('assessmentA').storage(), 'portal/assessmentC/cross-open.pdf'),
          pdfBytes,
          pdfMeta,
        ),
      );
    },
  );

  await check(
    'session for A CANNOT write to the legacy org evidence path — KNOWN_ISSUES #18',
    async () => {
      await assertFails(
        uploadBytes(
          ref(portal('assessmentA').storage(), 'orgs/org1/vendors/v1/evidence/x.pdf'),
          pdfBytes,
          pdfMeta,
        ),
      );
    },
  );

  await check('org member CAN write the org evidence path (org-scoped, not blanket-denied)', async () => {
    await assertSucceeds(
      uploadBytes(
        ref(member.storage(), 'orgs/org1/vendors/v1/evidence/member.pdf'),
        pdfBytes,
        pdfMeta,
      ),
    );
  });

  await check('org member CANNOT write another org\'s evidence path', async () => {
    await assertFails(
      uploadBytes(
        ref(member.storage(), 'orgs/org2/vendors/v1/evidence/foreign.pdf'),
        pdfBytes,
        pdfMeta,
      ),
    );
  });

  await check('unauthenticated CANNOT write portal path', async () => {
    await assertFails(
      uploadBytes(ref(unauth.storage(), 'portal/assessmentA/noauth.pdf'), pdfBytes, pdfMeta),
    );
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'assessments/assessmentA'), { portalOpen: false });
  });

  await check(
    'scoped session CANNOT write after portalOpen=false (approval closes the portal)',
    async () => {
      await assertFails(
        uploadBytes(
          ref(portal('assessmentA').storage(), 'portal/assessmentA/after-close.pdf'),
          pdfBytes,
          pdfMeta,
        ),
      );
    },
  );

  await check(
    'scoped session CANNOT read after portalOpen=false',
    async () => {
      await assertFails(
        getBytes(ref(portal('assessmentA').storage(), 'portal/assessmentA/evidence-a.pdf')),
      );
    },
  );

  await check(
    'org member CAN still read /portal/assessmentA/... after portalOpen=false',
    async () => {
      await assertSucceeds(getBytes(ref(member.storage(), 'portal/assessmentA/evidence-a.pdf')));
    },
  );

  await check(
    'org member CANNOT write /portal/assessmentA/... after portalOpen=false',
    async () => {
      await assertFails(
        uploadBytes(ref(member.storage(), 'portal/assessmentA/member-write.pdf'), pdfBytes, pdfMeta),
      );
    },
  );

  await testEnv.cleanup();

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
