/**
 * Lost-email reconcile for the extension -> self-managed mail worker handover.
 * See docs/SELF_MANAGED_EMAIL.md "Lost-email reconcile" and the #72 staging
 * cutover packet, addendum B.
 *
 * DRY RUN BY DEFAULT. A dry run reads only document ids, create times and the
 * `delivery` field (a projection; no recipients or message bodies), and prints
 * ids and counts as JSON. It builds no provider and reads no API key.
 *
 * --apply hands each CANDIDATE id to `worker.process(id)` exactly once. The
 * worker's transaction refuses docs already owned, terminal or pre-cutover, so
 * a repeated run cannot send twice. This script never writes `delivery`.
 *
 * Usage (dry run):
 *   npx tsx scripts/mail-reconcile.ts --project-id guardentra-staging \
 *     --database "(default)" --cutover-at 2026-11-01T15:00:00Z
 *
 * Usage (apply; separately owner-authorized, run as the worker SA):
 *   SENDGRID_API_KEY=... npx tsx scripts/mail-reconcile.ts --project-id guardentra-staging \
 *     --database "(default)" --cutover-at <same as MAIL_WORKER_CUTOVER_AT> \
 *     --apply --confirm-project guardentra-staging --max 10 \
 *     --mail-from admin@guardentra.com --provider-region us
 *
 * Targets: only guardentra-staging, or a demo-* project on a local Firestore
 * emulator. Production needs its own reviewed change (separate mail-queue DB).
 */
import { pathToFileURL } from 'node:url';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { listMailInventory } from '../server/lib/mailWorker/firestoreInventory';
import { createFirestoreMailStore } from '../server/lib/mailWorker/firestoreStore';
import { createSendGridProvider } from '../server/lib/mailWorker/provider';
import {
  applyReport, buildReport, DEFAULT_MAX_APPLY, DEFAULT_MIN_AGE_MS, HARD_MAX_APPLY,
  ReconcileError, type MailInventoryEntry, type ReconcileReport,
} from '../server/lib/mailWorker/reconcile';
import { createMailWorker } from '../server/lib/mailWorker/worker';

export const ALLOWED_PROJECTS = ['guardentra-staging'] as const;
const CUTOVER_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const EMULATOR_RE = /^(127\.0\.0\.1|localhost):\d+$/;
const VALUE_FLAGS = new Set([
  'project-id', 'database', 'cutover-at', 'min-age-seconds', 'confirm-project', 'max',
  'mail-from', 'provider-region',
]);
const BOOLEAN_FLAGS = new Set(['apply']);

export type ReconcileConfig = {
  projectId: string; database: string; cutoverMs: number; cutoverAt: string; minAgeMs: number;
  emulator: boolean;
  apply: null | { maxApply: number; from: string; region: 'us' | 'eu'; apiKey: string };
};

export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new ReconcileError('USAGE', `unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key in out) throw new ReconcileError('USAGE', `duplicate flag --${key}`);
    if (BOOLEAN_FLAGS.has(key)) { out[key] = true; continue; }
    if (!VALUE_FLAGS.has(key)) throw new ReconcileError('USAGE', `unknown flag --${key}`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new ReconcileError('USAGE', `--${key} needs a value`);
    out[key] = next;
    i += 1;
  }
  return out;
}

function str(args: Record<string, string | true>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export function resolveConfig(argv: string[], env: Record<string, string | undefined>): ReconcileConfig {
  const args = parseArgs(argv);
  const projectId = str(args, 'project-id');
  const database = str(args, 'database');
  const cutoverAt = str(args, 'cutover-at');
  if (!projectId || !database || !cutoverAt) {
    throw new ReconcileError('USAGE', '--project-id, --database and --cutover-at are required');
  }
  const host = env.FIRESTORE_EMULATOR_HOST;
  const emulator = Boolean(host);
  if (emulator) {
    if (!EMULATOR_RE.test(host!)) throw new ReconcileError('TARGET_REFUSED', 'emulator host must be localhost');
    if (!projectId.startsWith('demo-')) throw new ReconcileError('TARGET_REFUSED', 'emulator runs need a demo-* project');
  } else if (!(ALLOWED_PROJECTS as readonly string[]).includes(projectId)) {
    throw new ReconcileError('TARGET_REFUSED', `project ${projectId} is not allowed (staging only)`);
  }
  if (!/^[A-Za-z0-9()_-]{1,63}$/.test(database)) throw new ReconcileError('USAGE', 'invalid --database');
  const cutoverMs = Date.parse(cutoverAt);
  if (!CUTOVER_RE.test(cutoverAt) || !Number.isFinite(cutoverMs)) {
    throw new ReconcileError('USAGE', '--cutover-at must be a UTC ISO time ending in Z');
  }
  let minAgeMs = DEFAULT_MIN_AGE_MS;
  const minAge = str(args, 'min-age-seconds');
  if (minAge !== undefined) {
    if (!/^\d{1,6}$/.test(minAge)) throw new ReconcileError('USAGE', 'invalid --min-age-seconds');
    minAgeMs = Number(minAge) * 1000;
  }
  const applyOnly = ['confirm-project', 'max', 'mail-from', 'provider-region'].filter(k => k in args);
  if (!args.apply) {
    if (applyOnly.length) throw new ReconcileError('USAGE', `--${applyOnly[0]} is only valid with --apply`);
    return { projectId, database, cutoverMs, cutoverAt, minAgeMs, emulator, apply: null };
  }
  if (str(args, 'confirm-project') !== projectId) {
    throw new ReconcileError('USAGE', '--apply needs --confirm-project equal to --project-id');
  }
  const maxRaw = str(args, 'max') ?? String(DEFAULT_MAX_APPLY);
  const maxApply = /^\d{1,3}$/.test(maxRaw) ? Number(maxRaw) : NaN;
  if (!(maxApply >= 1 && maxApply <= HARD_MAX_APPLY)) {
    throw new ReconcileError('USAGE', `--max must be 1..${HARD_MAX_APPLY}`);
  }
  const from = str(args, 'mail-from');
  const region = str(args, 'provider-region');
  if (!from || (region !== 'us' && region !== 'eu')) {
    throw new ReconcileError('USAGE', '--apply needs --mail-from and --provider-region us|eu');
  }
  const apiKey = env.SENDGRID_API_KEY || '';
  if (!apiKey.trim()) throw new ReconcileError('USAGE', '--apply needs SENDGRID_API_KEY in the environment');
  return {
    projectId, database, cutoverMs, cutoverAt, minAgeMs, emulator,
    apply: { maxApply, from, region, apiKey },
  };
}

export type ReconcileDeps = {
  openDb(projectId: string, database: string): { db: Firestore; close(): Promise<void> };
  inventory(db: Firestore): Promise<MailInventoryEntry[]>;
  createProcess(db: Firestore, config: ReconcileConfig): (id: string) => Promise<string>;
  now(): number;
};

export const defaultDeps: ReconcileDeps = {
  openDb(projectId, database) {
    const app = initializeApp({ projectId }, `mail-reconcile-${Date.now()}`);
    const db = getFirestore(app, database);
    return { db, async close() { await db.terminate(); await deleteApp(app); } };
  },
  inventory: db => listMailInventory(db),
  createProcess(db, config) {
    const a = config.apply!;
    const worker = createMailWorker({
      store: createFirestoreMailStore(db),
      provider: createSendGridProvider({ apiKey: a.apiKey, from: a.from, region: a.region }),
      options: { enabled: true, cutoverMs: config.cutoverMs },
    });
    return id => worker.process(id);
  },
  now: () => Date.now(),
};

export async function runReconcile(config: ReconcileConfig, deps: ReconcileDeps = defaultDeps): Promise<ReconcileReport> {
  const { db, close } = deps.openDb(config.projectId, config.database);
  try {
    const entries = await deps.inventory(db);
    const report = buildReport(entries, { cutoverMs: config.cutoverMs, nowMs: deps.now(), minAgeMs: config.minAgeMs });
    if (!config.apply) return report;
    // Provider is built only after the inventory, and only in apply mode.
    return await applyReport(report, { process: deps.createProcess(db, config), maxApply: config.apply.maxApply });
  } finally {
    await close();
  }
}

export async function main(argv: string[], env: Record<string, string | undefined>, io: {
  out(s: string): void; err(s: string): void;
} = { out: s => process.stdout.write(s), err: s => process.stderr.write(s) }, deps: ReconcileDeps = defaultDeps): Promise<number> {
  let config: ReconcileConfig;
  try { config = resolveConfig(argv, env); } catch (e) {
    io.err(`${e instanceof ReconcileError ? e.message : 'USAGE: invalid arguments'}\n`);
    return 2;
  }
  try {
    const report = await runReconcile(config, deps);
    io.out(`${JSON.stringify({ projectId: config.projectId, database: config.database, ...report }, null, 2)}\n`);
    return report.applied?.some(a => a.result === 'FAILED') ? 3 : 0;
  } catch (e) {
    // Only our own coded messages; never SDK text (may carry paths or payload bits).
    io.err(`${e instanceof ReconcileError ? e.message : 'RECONCILE_FAILED'}\n`);
    return e instanceof ReconcileError ? 2 : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), process.env).then(code => { process.exitCode = code; });
}
