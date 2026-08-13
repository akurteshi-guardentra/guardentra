import { getAdminDb } from '../adminDb.ts';

let timer: ReturnType<typeof setInterval> | null = null;

function enabled(): boolean {
  const raw = (process.env.ASSESSMENT_REMINDER_WORKER_ENABLED || '').toLowerCase();
  return raw === 'true' || raw === '1';
}

function pollMs(): number {
  return Math.max(60_000, parseInt(process.env.ASSESSMENT_REMINDER_POLL_MS || '300000', 10) || 300_000);
}

export async function processAssessmentReminders(): Promise<number> {
  if (!enabled()) return 0;
  try {
    const db = getAdminDb();
    const snap = await db
      .collection('assessments')
      .where('portalOpen', '==', true)
      .where('status', 'in', ['Sent', 'In Progress', 'Due Soon'])
      .limit(40)
      .get();
    let queued = 0;
    const now = Date.now();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as {
        dueAt?: string;
        inviteEmail?: string;
        vendorName?: string;
        organizationId?: string;
        reminderSchedule?: { daysBeforeDue?: number; onDue?: boolean; daysAfterDue?: number };
        reminderScheduleId?: string;
        lastReminderKind?: string;
      };
      if (!data.dueAt || !data.inviteEmail || data.reminderScheduleId === 'none') continue;
      const dueMs = Date.parse(data.dueAt);
      if (!Number.isFinite(dueMs)) continue;
      const daysBefore = Number(data.reminderSchedule?.daysBeforeDue || 0);
      const daysAfter = Number(data.reminderSchedule?.daysAfterDue || 0);
      const onDue = Boolean(data.reminderSchedule?.onDue);
      const dayMs = 86_400_000;
      let kind: string | null = null;
      if (daysBefore > 0 && now >= dueMs - daysBefore * dayMs && now < dueMs - (daysBefore - 1) * dayMs) {
        kind = `before_${daysBefore}`;
      } else if (onDue && now >= dueMs && now < dueMs + dayMs) {
        kind = 'on_due';
      } else if (daysAfter > 0 && now >= dueMs + daysAfter * dayMs && now < dueMs + (daysAfter + 1) * dayMs) {
        kind = `after_${daysAfter}`;
      }
      if (!kind || data.lastReminderKind === kind) continue;
      await db.collection('mail').add({
        to: [data.inviteEmail],
        message: {
          subject: `Reminder: security assessment for ${data.vendorName || 'your organization'}`,
          text: `This is a Guardentra reminder (${kind.replace(/_/g, ' ')}) for the open security assessment. Please complete it before or as soon as possible after the due date.`,
        },
        createdAt: new Date().toISOString(),
      });
      await docSnap.ref.set(
        { lastReminderKind: kind, lastReminderAt: new Date().toISOString() },
        { merge: true }
      );
      queued += 1;
    }
    if (queued) console.log(`[reminder-worker] queued ${queued} reminder(s)`);
    return queued;
  } catch (err) {
    console.warn('[reminder-worker] tick failed (non-fatal)', err);
    return 0;
  }
}

export function startAssessmentReminderWorker(): void {
  if (!enabled()) {
    console.log('[reminder-worker] disabled (set ASSESSMENT_REMINDER_WORKER_ENABLED=true)');
    return;
  }
  if (timer) return;
  console.log(`[reminder-worker] starting poll every ${pollMs()}ms`);
  void processAssessmentReminders();
  timer = setInterval(() => void processAssessmentReminders(), pollMs());
}

