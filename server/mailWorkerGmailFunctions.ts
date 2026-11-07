/**
 * Google Workspace (Gmail API) variant of the self-managed mail worker.
 * Separate codebase entrypoint. Intentionally NOT wired into firebase.json.
 *
 * Unlike the SendGrid entrypoint it binds NO secret: the runtime service account
 * (MAIL_WORKER_SERVICE_ACCOUNT) mints a delegated token for MAIL_GMAIL_SENDER with
 * the gmail.send scope only. See docs/SELF_MANAGED_EMAIL.md "Google Workspace".
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineBoolean, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { createFirestoreMailStore } from './lib/mailWorker/firestoreStore';
import { createDelegatedTokenSource, createGmailApiProvider } from './lib/mailWorker/gmailProvider';
import { createMailWorker } from './lib/mailWorker/worker';

const enabled = defineBoolean('MAIL_WORKER_ENABLED', { default: false });
const cutover = defineString('MAIL_WORKER_CUTOVER_AT', { default: '' });
const database = defineString('MAIL_WORKER_DATABASE');
const region = defineString('MAIL_WORKER_REGION');
const identity = defineString('MAIL_WORKER_SERVICE_ACCOUNT');
const sender = defineString('MAIL_GMAIL_SENDER');
const from = defineString('MAIL_FROM');
const fromName = defineString('MAIL_FROM_NAME', { default: '' });
const replyTo = defineString('MAIL_REPLY_TO', { default: '' });

let cachedWorker: ReturnType<typeof createMailWorker> | null = null;

function worker() {
  if (cachedWorker) return cachedWorker;
  const cutoverMs = Date.parse(cutover.value());
  if (!Number.isFinite(cutoverMs) || !/Z$/.test(cutover.value()) || !database.value()) {
    throw new Error('MAIL_WORKER_CONFIG_INVALID');
  }
  const app = getApps().find(app => app.name === 'mail-worker') || initializeApp({}, 'mail-worker');
  // Reused across invocations of a warm instance so the delegated token is cached.
  cachedWorker = createMailWorker({
    store: createFirestoreMailStore(getFirestore(app, database.value())),
    provider: createGmailApiProvider({
      from: from.value(), fromName: fromName.value() || undefined, replyTo: replyTo.value() || undefined,
      tokens: createDelegatedTokenSource({ serviceAccount: identity.value(), sender: sender.value() }),
    }),
    options: { enabled: true, cutoverMs },
    observe: event => console.info(JSON.stringify(event)),
  });
  return cachedWorker;
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

/** Test-only: forget the warm-instance worker. */
export function resetGmailWorkerForTests() { cachedWorker = null; }

export const deliverMail = onDocumentCreated({
  document: 'mail/{mailId}', database, region, serviceAccount: identity,
  retry: true, timeoutSeconds: 60, maxInstances: 5, concurrency: 1,
}, event => handleMailCreated(event.params.mailId));

export const recoverMail = onSchedule({
  schedule: 'every 1 minutes', region, serviceAccount: identity,
  timeoutSeconds: 540, maxInstances: 1, concurrency: 1,
}, () => handleMailRecovery());
