/** Separate codebase entrypoint. Intentionally NOT wired into firebase.json. */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { createFirestoreMailStore } from './lib/mailWorker/firestoreStore';
import { createSendGridProvider } from './lib/mailWorker/provider';
import { createMailWorker } from './lib/mailWorker/worker';

const enabled = defineBoolean('MAIL_WORKER_ENABLED', { default: false });
const cutover = defineString('MAIL_WORKER_CUTOVER_AT', { default: '' });
const database = defineString('MAIL_WORKER_DATABASE');
const region = defineString('MAIL_WORKER_REGION');
const identity = defineString('MAIL_WORKER_SERVICE_ACCOUNT');
const providerRegion = defineString('MAIL_PROVIDER_REGION');
const from = defineString('MAIL_FROM');
const apiKey = defineSecret('SENDGRID_API_KEY');

function worker() {
  const cutoverMs = Date.parse(cutover.value());
  if (!Number.isFinite(cutoverMs) || !/Z$/.test(cutover.value()) ||
      !['us', 'eu'].includes(providerRegion.value()) || !database.value()) {
    throw new Error('MAIL_WORKER_CONFIG_INVALID');
  }
  const app = getApps().find(app => app.name === 'mail-worker') || initializeApp({}, 'mail-worker');
  return createMailWorker({
    store: createFirestoreMailStore(getFirestore(app, database.value())),
    provider: createSendGridProvider({
      apiKey: apiKey.value(), from: from.value(), region: providerRegion.value() as 'us' | 'eu',
    }),
    options: { enabled: true, cutoverMs },
    observe: event => console.info(JSON.stringify(event)),
  });
}

/** Exported handlers permit local testing without cloud invocation. */
export async function handleMailCreated(id: string) {
  if (!enabled.value()) return;
  try { await worker().process(id); }
  catch { throw new Error('MAIL_WORKER_FAILED'); } // Never propagate SDK errors/payloads.
}

export async function handleMailRecovery() {
  if (!enabled.value()) return;
  try { await worker().sweep(); }
  catch { throw new Error('MAIL_WORKER_FAILED'); }
}

export const deliverMail = onDocumentCreated({
  document: 'mail/{mailId}', database, region, serviceAccount: identity,
  secrets: [apiKey], retry: true, timeoutSeconds: 60, maxInstances: 5, concurrency: 1,
}, event => handleMailCreated(event.params.mailId));

export const recoverMail = onSchedule({
  schedule: 'every 1 minutes', region, serviceAccount: identity, secrets: [apiKey],
  timeoutSeconds: 540, maxInstances: 1, concurrency: 1,
}, () => handleMailRecovery());
