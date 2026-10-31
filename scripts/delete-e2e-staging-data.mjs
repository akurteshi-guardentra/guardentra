/**
 * Delete synthetic staging data from the #124 go-live acceptance run.
 * Run with: node --env-file=.env.local scripts/delete-e2e-staging-data.mjs
 * or:       GOOGLE_APPLICATION_CREDENTIALS=<path-to-sa-key.json> node scripts/delete-e2e-staging-data.mjs
 *
 * Requires firebase-admin and access to guardentra-staging project.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const PROJECT_ID = 'guardentra-staging';
const STORAGE_BUCKET = 'guardentra-staging.appspot.com';

const ORG_ID = 'qYQcinJu0aK5oQIZHK1z';
const UID = 'ZL1ONGPkU2SSST0adN9uHSEDy763';
const VENDOR_ID = 'vendor_23d0f5d8a5b6e28b9fd2cf45ffc5ed160712c68e';
const ASSESSMENT_ID = 'asm_064d085febcb14a3e576bf5c611af5e1';

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });
}

const db = getFirestore();
const auth = getAuth();
const storage = getStorage().bucket();

async function deleteCollection(ref) {
  const snap = await ref.limit(100).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`  deleted ${snap.size} docs from ${ref.path}`);
  if (snap.size === 100) await deleteCollection(ref); // paginate
}

async function deleteStoragePrefix(prefix) {
  const [files] = await storage.getFiles({ prefix });
  if (!files.length) { console.log(`  no storage files under ${prefix}`); return; }
  await Promise.all(files.map(f => f.delete()));
  console.log(`  deleted ${files.length} storage file(s) under ${prefix}`);
}

async function main() {
  console.log('=== Deleting synthetic #124 e2e data from', PROJECT_ID, '===');

  // 1. Assessment and its subcollections
  console.log('\n[1] Assessment', ASSESSMENT_ID);
  const asmRef = db.collection('assessments').doc(ASSESSMENT_ID);
  const subcols = await asmRef.listCollections();
  for (const sc of subcols) {
    await deleteCollection(sc);
  }
  await asmRef.delete();
  console.log('  assessment doc deleted');

  // 2. Vendor
  console.log('\n[2] Vendor', VENDOR_ID);
  const vendorRef = db.collection('orgs').doc(ORG_ID).collection('vendors').doc(VENDOR_ID);
  const vSubcols = await vendorRef.listCollections();
  for (const sc of vSubcols) await deleteCollection(sc);
  // Also top-level vendor collection if it exists
  const topVendor = db.collection('vendors').doc(VENDOR_ID);
  await topVendor.delete().catch(() => {});
  await vendorRef.delete();
  console.log('  vendor doc deleted');

  // 3. Org and its subcollections
  console.log('\n[3] Org', ORG_ID);
  const orgRef = db.collection('orgs').doc(ORG_ID);
  const orgSubcols = await orgRef.listCollections();
  for (const sc of orgSubcols) await deleteCollection(sc);
  await orgRef.delete();
  console.log('  org doc deleted');

  // 4. User account
  console.log('\n[4] Auth user', UID);
  await auth.deleteUser(UID).catch(e => console.log('  auth user already gone or error:', e.message));
  console.log('  auth user deleted');

  // 5. User Firestore doc
  await db.collection('users').doc(UID).delete().catch(() => {});
  console.log('  users/', UID, 'deleted');

  // 6. Storage
  console.log('\n[5] Storage portal/', ASSESSMENT_ID);
  await deleteStoragePrefix(`portal/${ASSESSMENT_ID}/`);

  // 7. Trigger Email / mail queue docs referencing this org
  console.log('\n[6] Mail queue docs');
  const mailSnap = await db.collection('mail')
    .where('to', 'array-contains', 'admin+e2e124-20261030@guardentra.com')
    .limit(20).get().catch(() => ({ empty: true, docs: [] }));
  if (!mailSnap.empty) {
    const batch = db.batch();
    mailSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log('  deleted', mailSnap.docs.length, 'mail doc(s)');
  } else {
    console.log('  no mail docs found (or query not supported)');
  }

  console.log('\n=== Done. All synthetic e2e data removed from staging. ===');
}

main().catch(e => { console.error(e); process.exit(1); });
