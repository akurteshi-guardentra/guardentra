/**
 * Storage rules unit tests for /portal/{assessmentId}/{fileName}.
 * Run via: npm run test:storage-rules
 * (starts Firestore + Storage emulators, then executes this file)
 *
 * Note: rules check the assessmentId in the Storage path against that doc's
 * portalOpen / org membership. They do not bind an anonymous Auth uid to a
 * single assessment — if assessment B is also portalOpen, another open portal
 * path is reachable (same model as firestore.rules isOpenPortalAssessment).
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

  console.log('Matrix:');

  await check(
    'anonymous CAN write /portal/assessmentA/... when portalOpen=true',
    async () => {
      await assertSucceeds(
        uploadBytes(ref(anon.storage(), 'portal/assessmentA/evidence-a.pdf'), pdfBytes, pdfMeta),
      );
    },
  );

  await check(
    'anonymous CAN read /portal/assessmentA/... when portalOpen=true',
    async () => {
      await assertSucceeds(getBytes(ref(anon.storage(), 'portal/assessmentA/evidence-a.pdf')));
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
    'anonymous CAN write /portal/assessmentC/... when C is also portalOpen (no uid↔assessment bind)',
    async () => {
      await assertSucceeds(
        uploadBytes(ref(anon.storage(), 'portal/assessmentC/cross-open.pdf'), pdfBytes, pdfMeta),
      );
    },
  );

  await check('unauthenticated CANNOT write portal path', async () => {
    await assertFails(
      uploadBytes(ref(unauth.storage(), 'portal/assessmentA/noauth.pdf'), pdfBytes, pdfMeta),
    );
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'assessments/assessmentA'), { portalOpen: false });
  });

  await check(
    'anonymous CANNOT write /portal/assessmentA/... after portalOpen=false',
    async () => {
      await assertFails(
        uploadBytes(ref(anon.storage(), 'portal/assessmentA/after-close.pdf'), pdfBytes, pdfMeta),
      );
    },
  );

  await check(
    'anonymous CANNOT read /portal/assessmentA/... after portalOpen=false',
    async () => {
      await assertFails(getBytes(ref(anon.storage(), 'portal/assessmentA/evidence-a.pdf')));
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
