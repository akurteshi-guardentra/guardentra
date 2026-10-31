/**
 * Delete synthetic staging data from the #124 go-live acceptance run.
 *
 * Usage:
 *   node scripts/delete-e2e-staging-data.mjs [--dry-run]
 *
 * Requires application default credentials for guardentra-staging:
 *   gcloud auth application-default login
 *   GOOGLE_APPLICATION_CREDENTIALS=<path-to-sa-key.json>
 *
 * Pass --dry-run to print what would be deleted without touching anything.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const DRY_RUN = process.argv.includes('--dry-run');
const PROJECT_ID = 'guardentra-staging';
// Verified bucket name: guardentra-staging.firebasestorage.app (NOT .appspot.com)
const STORAGE_BUCKET = 'guardentra-staging.firebasestorage.app';

const ORG_ID = 'qYQcinJu0aK5oQIZHK1z';
const UID = 'ZL1ONGPkU2SSST0adN9uHSEDy763';
const VENDOR_ID = 'vendor_23d0f5d8a5b6e28b9fd2cf45ffc5ed160712c68e';
const ASSESSMENT_ID = 'asm_064d085febcb14a3e576bf5c611af5e1';
// Vendor invite doc id (under vendor_invites/)
const VENDOR_INVITE_ID = `vendor_welcome_${VENDOR_ID}`;
// Mail docs (keyed by their ids, addresses the vendor contact, not the admin)
const MAIL_DOC_IDS = [
  `notify_vendor_welcome_${VENDOR_ID}`,
  `notify_assessment_invite_${ASSESSMENT_ID}`,
];

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });
}
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

const log = (...args) => console.log(...args);
const action = DRY_RUN ? '[DRY-RUN] would delete' : 'deleted';

async function deleteDocAndSubcols(ref) {
  let subcols;
  try {
    subcols = await ref.listCollections();
  } catch (e) {
    log(`  WARNING: could not list subcollections of ${ref.path}: ${e.message}`);
    subcols = [];
  }
  for (const sc of subcols) {
    await deleteCollection(sc);
  }
  if (!DRY_RUN) {
    await ref.delete();
    log(`  ${action}: ${ref.path}`);
  } else {
    log(`  ${action}: ${ref.path} (+ ${subcols.length} subcollection(s))`);
  }
}

async function deleteCollection(ref) {
  let snap;
  try {
    snap = await ref.limit(100).get();
  } catch (e) {
    log(`  WARNING: could not read ${ref.path}: ${e.message}`);
    return;
  }
  if (snap.empty) {
    log(`  (empty collection: ${ref.path})`);
    return;
  }
  if (DRY_RUN) {
    log(`  ${action}: ${snap.size} doc(s) in ${ref.path}`);
    return;
  }
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  log(`  ${action}: ${snap.size} doc(s) from ${ref.path}`);
  if (snap.size === 100) await deleteCollection(ref);
}

async function deleteStoragePrefix(prefix) {
  let files;
  try {
    [files] = await bucket.getFiles({ prefix });
  } catch (e) {
    log(`  WARNING: storage list failed for ${prefix}: ${e.message}`);
    return;
  }
  if (!files.length) {
    log(`  (no storage files under ${prefix})`);
    return;
  }
  log(`  ${action}: ${files.length} storage file(s) under ${prefix}:`);
  files.forEach(f => log(`    - ${f.name}`));
  if (!DRY_RUN) {
    await Promise.all(files.map(f => f.delete()));
  }
}

async function main() {
  if (DRY_RUN) log('=== DRY RUN — nothing will be deleted ===');
  log(`\n=== Deleting synthetic #124 e2e data from ${PROJECT_ID} ===\n`);

  // 1. Assessment and its subcollections
  log('[1] Assessment:', ASSESSMENT_ID);
  await deleteDocAndSubcols(db.collection('assessments').doc(ASSESSMENT_ID));

  // 2. Vendor (top-level vendors/ collection — confirmed path)
  log('\n[2] Vendor:', VENDOR_ID);
  await deleteDocAndSubcols(db.collection('vendors').doc(VENDOR_ID));

  // 3. Vendor invite
  log('\n[3] Vendor invite:', VENDOR_INVITE_ID);
  const viRef = db.collection('vendor_invites').doc(VENDOR_INVITE_ID);
  const viSnap = await viRef.get().catch(() => null);
  if (viSnap && viSnap.exists) {
    if (!DRY_RUN) { await viRef.delete(); }
    log(`  ${action}: vendor_invites/${VENDOR_INVITE_ID}`);
  } else {
    log(`  (not found — already gone or wrong id)`);
  }

  // 4. Mail queue docs (addressed to vendor contact)
  log('\n[4] Mail docs:');
  for (const id of MAIL_DOC_IDS) {
    const ref = db.collection('mail').doc(id);
    const snap = await ref.get().catch(() => null);
    if (snap && snap.exists) {
      if (!DRY_RUN) { await ref.delete(); }
      log(`  ${action}: mail/${id}`);
    } else {
      log(`  (not found: mail/${id})`);
    }
  }

  // 5. Org and its subcollections (collection is organizations/, not orgs/)
  log('\n[5] Org:', ORG_ID);
  await deleteDocAndSubcols(db.collection('organizations').doc(ORG_ID));

  // 6. Auth user + users/ doc
  log('\n[6] Auth user:', UID);
  if (!DRY_RUN) {
    await auth.deleteUser(UID).catch(e => log(`  WARNING auth delete: ${e.message}`));
    await db.collection('users').doc(UID).delete().catch(() => {});
    log(`  ${action}: auth user ${UID} and users/${UID}`);
  } else {
    log(`  ${action}: auth user ${UID} and users/${UID}`);
  }

  // 7. Storage (evidence files)
  log('\n[7] Storage portal/', ASSESSMENT_ID);
  await deleteStoragePrefix(`portal/${ASSESSMENT_ID}/`);

  // 8. Note on audit events — NOT deleted by default
  log('\n[8] audit_material_intents: NOT deleted (audit trail; owner decision required)');

  log(`\n=== ${DRY_RUN ? 'DRY RUN complete' : 'Done'} ===`);
}

main().catch(e => { console.error('\nFATAL:', e); process.exit(1); });
