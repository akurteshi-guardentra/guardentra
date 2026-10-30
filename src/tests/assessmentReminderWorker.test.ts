import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  assessmentGet: vi.fn(),
  markerSet: vi.fn(),
  mailCreate: vi.fn(),
  mailDoc: vi.fn(),
  collection: vi.fn(),
}));

vi.mock('../../server/lib/adminDb.ts', () => ({
  getAdminDb: () => ({
    collection: h.collection,
  }),
}));

import {
  assessmentReminderQueueId,
  processAssessmentReminders,
} from '../../server/lib/reminders/worker';

function buildDbFixture() {
  const assessmentQuery: {
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  } = {
    where: vi.fn(),
    limit: vi.fn(),
    get: h.assessmentGet,
  };
  assessmentQuery.where.mockReturnValue(assessmentQuery);
  assessmentQuery.limit.mockReturnValue(assessmentQuery);

  const mailCollection = {
    doc: h.mailDoc,
  };

  h.mailDoc.mockImplementation(() => ({
    create: h.mailCreate,
  }));

  h.collection.mockImplementation((name: string) => {
    if (name === 'assessments') return assessmentQuery;
    if (name === 'mail') return mailCollection;
    throw new Error(`unexpected collection ${name}`);
  });
}

function dueAssessment() {
  return {
    id: 'asm_123',
    data: () => ({
      dueAt: new Date(Date.now() - 1_000).toISOString(),
      inviteEmail: 'vendor@example.com',
      vendorName: 'Example Vendor',
      organizationId: 'org_123',
      reminderSchedule: { onDue: true },
    }),
    ref: {
      set: h.markerSet,
    },
  };
}

describe('#152 assessment reminder idempotency', () => {
  beforeEach(() => {
    process.env.ASSESSMENT_REMINDER_WORKER_ENABLED = 'true';
    h.assessmentGet.mockReset();
    h.markerSet.mockReset();
    h.mailCreate.mockReset();
    h.mailDoc.mockReset();
    h.collection.mockReset();
    buildDbFixture();
    h.assessmentGet.mockResolvedValue({ docs: [dueAssessment()] });
    h.markerSet.mockResolvedValue(undefined);
    h.mailCreate.mockResolvedValue(undefined);
  });

  it('builds one deterministic queue id per assessment and reminder kind', () => {
    expect(assessmentReminderQueueId('asm_123', 'on_due')).toBe(
      'assessment-reminder_asm_123_on_due',
    );
    expect(assessmentReminderQueueId('asm_123', 'on_due')).toBe(
      assessmentReminderQueueId('asm_123', 'on_due'),
    );
  });

  it('creates one durable mail intent before marking the reminder complete', async () => {
    await expect(processAssessmentReminders()).resolves.toBe(1);

    expect(h.mailDoc).toHaveBeenCalledWith('assessment-reminder_asm_123_on_due');
    expect(h.mailCreate).toHaveBeenCalledTimes(1);
    expect(h.mailCreate.mock.calls[0]?.[0]).toMatchObject({
      to: ['vendor@example.com'],
      source: 'guardentra.reminder',
      notification: {
        intentType: 'assessment_reminder',
        assessmentId: 'asm_123',
        organizationId: 'org_123',
        reminderKind: 'on_due',
      },
    });
    expect(h.markerSet).toHaveBeenCalledTimes(1);
  });

  it('treats an existing deterministic mail intent as deduplicated and repairs the marker', async () => {
    h.mailCreate.mockRejectedValue(
      Object.assign(new Error('exists'), { code: 'already-exists' }),
    );

    await expect(processAssessmentReminders()).resolves.toBe(0);

    expect(h.mailDoc).toHaveBeenCalledWith('assessment-reminder_asm_123_on_due');
    expect(h.mailCreate).toHaveBeenCalledTimes(1);
    expect(h.markerSet).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate mail when marker persistence fails after the first queue write', async () => {
    h.markerSet
      .mockRejectedValueOnce(new Error('marker unavailable'))
      .mockResolvedValueOnce(undefined);

    await expect(processAssessmentReminders()).resolves.toBe(0);
    expect(h.mailCreate).toHaveBeenCalledTimes(1);

    h.mailCreate.mockRejectedValueOnce(
      Object.assign(new Error('exists'), { code: 6 }),
    );

    await expect(processAssessmentReminders()).resolves.toBe(0);

    expect(h.mailDoc).toHaveBeenNthCalledWith(
      1,
      'assessment-reminder_asm_123_on_due',
    );
    expect(h.mailDoc).toHaveBeenNthCalledWith(
      2,
      'assessment-reminder_asm_123_on_due',
    );
    expect(h.mailCreate).toHaveBeenCalledTimes(2);
    expect(h.markerSet).toHaveBeenCalledTimes(2);
  });
});
