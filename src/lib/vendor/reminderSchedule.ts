/**
 * FastTrack send-step reminder configuration (stored on assessment docs).
 * Delivery still depends on Trigger Email + SMTP (see docs/ENVIRONMENTS.md).
 */
export type ReminderScheduleId = 'none' | 'due_only' | 'before_and_due' | 'before_due_after';

export type ReminderSchedule = {
  id: ReminderScheduleId;
  /** Days before dueAt to send first reminder (0 = skip). */
  daysBeforeDue: number;
  /** Send on the due date. */
  onDue: boolean;
  /** Days after dueAt for overdue nudge (0 = skip). */
  daysAfterDue: number;
  label: string;
};

export const REMINDER_SCHEDULES: ReminderSchedule[] = [
  {
    id: 'none',
    daysBeforeDue: 0,
    onDue: false,
    daysAfterDue: 0,
    label: 'No automatic reminders (manual only)',
  },
  {
    id: 'due_only',
    daysBeforeDue: 0,
    onDue: true,
    daysAfterDue: 0,
    label: 'On due date only',
  },
  {
    id: 'before_and_due',
    daysBeforeDue: 3,
    onDue: true,
    daysAfterDue: 0,
    label: '3 days before + on due date',
  },
  {
    id: 'before_due_after',
    daysBeforeDue: 3,
    onDue: true,
    daysAfterDue: 3,
    label: '3 days before, on due, and 3 days overdue',
  },
];

export function reminderScheduleById(id: string | null | undefined): ReminderSchedule {
  return REMINDER_SCHEDULES.find((s) => s.id === id) || REMINDER_SCHEDULES[2];
}
