/**
 * Local emulator seed for the October 18 rehearsal.
 * Refuses any host that is not the local Firebase emulator.
 * Does not call Google Cloud, send mail, or write staging/production.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'demo-guardentra-local';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '';
const EMAIL = 'synthetic.presenter@example.test';
const PASSWORD = 'synthetic-demo-pass';
const ORG_ID = 'synthetic-org-oct18';

function assertLocalHost(name, value) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(value)) {
    throw new Error(`${name} must be a localhost emulator address. Refusing "${value || '(unset)'}".`);
  }
}

assertLocalHost('FIREBASE_AUTH_EMULATOR_HOST', AUTH_HOST);
assertLocalHost('FIRESTORE_EMULATOR_HOST', FIRESTORE_HOST);

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

const now = new Date().toISOString();
let user = null;
try {
  user = await auth.getUserByEmail(EMAIL);
} catch {
  user = await auth.createUser({
    email: EMAIL,
    password: PASSWORD,
    displayName: 'Synthetic Presenter',
    emailVerified: true,
  });
}

const question = {
  id: 'q_1',
  controlKey: 'synthetic_mfa_required',
  category: 'Access Control',
  question: 'SYNTHETIC: Is MFA required for vendor administrator accounts?',
  type: 'yesno',
  options: ['Yes', 'No', 'Partially', 'Not Applicable'],
  required: true,
};

await db.doc(`organizations/${ORG_ID}`).set({
  name: "SYNTHETIC Northwind Review Org",
  createdAt: now,
  autoCreated: false,
  dataRegion: 'us',
  planId: 'starter',
  vendorCount: 2,
  vendorCap: 10,
  seatCount: 1,
  seatCap: 5,
  subscriptionStatus: 'none',
  synthetic: true,
  syntheticLabel: 'LOCAL_FIXTURE',
});

await db.doc(`users/${user.uid}`).set({
  email: EMAIL,
  displayName: 'Synthetic Presenter',
  role: 'admin',
  organizationId: ORG_ID,
  organizationName: "SYNTHETIC Northwind Review Org",
  onboarded: true,
  synthetic: true,
});

await db.doc('vendors/synthetic-vendor-harbor').set({
  organizationId: ORG_ID,
  name: 'SYNTHETIC Harbor Logistics',
  category: 'Logistics',
  criticality: 'High',
  status: 'Active',
  ownerName: 'Synthetic Presenter',
  primaryContactName: 'Fixture Contact',
  primaryContactEmail: 'harbor.fixture@example.test',
  createdAt: now,
  synthetic: true,
});

await db.doc('vendors/synthetic-vendor-lumen').set({
  organizationId: ORG_ID,
  name: 'SYNTHETIC Lumen Clinic Supplies',
  category: 'Healthcare',
  criticality: 'Medium',
  status: 'Active',
  ownerName: 'Synthetic Presenter',
  primaryContactName: 'Fixture Contact',
  primaryContactEmail: 'lumen.fixture@example.test',
  createdAt: now,
  synthetic: true,
});

await db.doc('assessments/synthetic-assessment-responded').set({
  organizationId: ORG_ID,
  vendorId: 'synthetic-vendor-harbor',
  vendorName: 'SYNTHETIC Harbor Logistics',
  frameworks: ['nist_csf_2'],
  frameworkName: 'SYNTHETIC NIST CSF sample',
  status: 'Under Review',
  progressPct: 100,
  questionCount: 1,
  questions: [question],
  answers: { q_1: 'Yes' },
  comments: { q_1: 'SYNTHETIC fixture answer. Not a vendor submission.' },
  portalOpen: false,
  createdAt: now,
  synthetic: true,
  syntheticLabel: 'LOCAL_FIXTURE',
});

await db.doc('assessments/synthetic-assessment-pending').set({
  organizationId: ORG_ID,
  vendorId: 'synthetic-vendor-lumen',
  vendorName: 'SYNTHETIC Lumen Clinic Supplies',
  frameworks: ['soc2'],
  frameworkName: 'SYNTHETIC SOC 2 sample',
  status: 'Sent',
  progressPct: 0,
  questionCount: 1,
  questions: [question],
  answers: {},
  portalOpen: false,
  createdAt: now,
  synthetic: true,
  syntheticLabel: 'LOCAL_FIXTURE',
});

await db.doc('audit_readiness/synthetic-readiness').set({
  organizationId: ORG_ID,
  readinessScore: 64,
  synthetic: true,
  syntheticLabel: 'LOCAL_FIXTURE_NOT_AN_AUDIT',
});

process.stdout.write(
  `${JSON.stringify(
    {
      projectId: PROJECT_ID,
      authEmulator: AUTH_HOST,
      firestoreEmulator: FIRESTORE_HOST,
      email: EMAIL,
      password: PASSWORD,
      organizationId: ORG_ID,
      uid: user.uid,
      label: 'LOCAL_FIXTURE',
    },
    null,
    2,
  )}\n`,
);
