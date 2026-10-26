/**
 * Portal identity check against the loopback demo server and emulators.
 * Uses POST /api/portal/session (no hand-minted token) and a Firebase app
 * that is not the reviewer session.
 *
 * Usage: node scripts/local-demo-isolation-check.mjs <assessmentId>
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from 'firebase/firestore';
import { getApps, initializeApp as initializeAdmin } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const assessmentA = String(process.argv[2] || '').trim();
if (!assessmentA) {
  console.error('assessment id required');
  process.exit(2);
}

const origin = 'http://127.0.0.1:5173';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'demo-guardentra-local';

if (!getApps().length) {
  initializeAdmin({ projectId: 'demo-guardentra-local' });
}
const adminDb = getAdminFirestore();

const report = {
  assessmentA,
  assessmentB: null,
  sessionStatus: null,
  sessionError: null,
  ownRead: null,
  otherReadDenied: null,
  ownWrite: null,
  otherWriteDenied: null,
  decisionStatus: null,
  decisionBody: null,
  statusBefore: null,
};

const sessionRes = await fetch(`${origin}/api/portal/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assessmentId: assessmentA }),
});
report.sessionStatus = sessionRes.status;
const sessionBody = await sessionRes.json().catch(() => ({}));
if (!sessionRes.ok || !sessionBody.token) {
  report.sessionError = sessionBody.error || 'no token';
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const before = await adminDb.collection('assessments').doc(assessmentA).get();
report.statusBefore = before.exists ? String(before.data()?.status || '') : 'missing';

const others = await adminDb.collection('assessments').limit(20).get();
const other = others.docs.find((d) => d.id !== assessmentA);
if (!other) {
  report.sessionError = 'no second assessment to use as the denied target';
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
report.assessmentB = other.id;

const app = initializeApp(
  {
    apiKey: 'AIzaSyDummyVitestFirebaseKey000',
    authDomain: 'demo-guardentra-local.firebaseapp.com',
    projectId: 'demo-guardentra-local',
    storageBucket: 'demo-guardentra-local.appspot.com',
    appId: '1:123456789012:web:abcdef0123456789abcdef',
  },
  `isolation-${assessmentA.slice(0, 12)}`,
);
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
await signInWithCustomToken(auth, sessionBody.token);

try {
  const own = await getDoc(doc(db, 'assessments', assessmentA));
  report.ownRead = own.exists();
} catch (err) {
  report.ownRead = err instanceof Error ? err.code || err.message : 'error';
}

try {
  await getDoc(doc(db, 'assessments', other.id));
  report.otherReadDenied = false;
} catch (err) {
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  report.otherReadDenied = code === 'permission-denied';
}

const canAutosave = report.statusBefore === 'Sent' || report.statusBefore === 'In Progress';
if (canAutosave) {
  try {
    await updateDoc(doc(db, 'assessments', assessmentA), {
      updatedAt: new Date().toISOString(),
    });
    report.ownWrite = true;
  } catch (err) {
    report.ownWrite = err instanceof Error ? err.code || err.message : 'error';
  }
} else {
  report.ownWrite = `skipped-status-${report.statusBefore}`;
}

try {
  await updateDoc(doc(db, 'assessments', other.id), {
    updatedAt: new Date().toISOString(),
  });
  report.otherWriteDenied = false;
} catch (err) {
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  report.otherWriteDenied = code === 'permission-denied';
}

const idToken = await auth.currentUser.getIdToken();
const decision = await fetch(`${origin}/api/org/assessment-decision`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    assessmentId: assessmentA,
    outcome: 'conditional',
    decisionNotes: 'isolation probe must be denied',
    remediationOwner: 'isolation',
    remediationDueAt: '2026-11-01',
    residualRiskLevel: 'Medium',
  }),
});
report.decisionStatus = decision.status;
report.decisionBody = await decision.json().catch(() => null);

const ok =
  report.sessionStatus === 200 &&
  report.ownRead === true &&
  report.otherReadDenied === true &&
  report.otherWriteDenied === true &&
  report.decisionStatus === 403 &&
  (report.ownWrite === true || String(report.ownWrite).startsWith('skipped-status-'));

console.log(JSON.stringify(report, null, 2));
process.exit(ok ? 0 : 1);
