import { describe, expect, it } from 'vitest';
import {
  buildMailQueueDocument,
  isMailDeliveryError,
  isMailDeliverySuccess,
  MAIL_COLLECTION,
  MAIL_QUEUE_SOURCE,
} from '../../server/lib/mailQueue';

describe('mailQueue firestore-send-email schema', () => {
  it('builds Trigger Email-compatible mail documents', () => {
    const doc = buildMailQueueDocument({
      to: '  akurteshi@guardentra.com ',
      subject: ' Vendor invite ',
      text: ' Please complete your assessment. ',
      html: '<p>Please complete your assessment.</p>',
      createdAt: '2026-09-21T00:00:00.000Z',
    });

    expect(MAIL_COLLECTION).toBe('mail');
    expect(doc).toEqual({
      to: ['akurteshi@guardentra.com'],
      message: {
        subject: 'Vendor invite',
        text: 'Please complete your assessment.',
        html: '<p>Please complete your assessment.</p>',
      },
      createdAt: '2026-09-21T00:00:00.000Z',
      source: MAIL_QUEUE_SOURCE,
    });
    // Extension owns delivery.*; queue writer must not seed it.
    expect(doc).not.toHaveProperty('delivery');
    expect(doc).not.toHaveProperty('from');
  });

  it('omits empty html so message stays text+subject only', () => {
    const doc = buildMailQueueDocument({
      to: 'vendor@example.com',
      subject: 'Hi',
      text: 'Body',
      html: '   ',
      createdAt: '2026-09-21T00:00:00.000Z',
    });
    expect(doc.message).toEqual({ subject: 'Hi', text: 'Body' });
  });

  it('maps extension delivery states for observability helpers', () => {
    expect(isMailDeliverySuccess('SUCCESS')).toBe(true);
    expect(isMailDeliverySuccess('PENDING')).toBe(false);
    expect(isMailDeliveryError('ERROR')).toBe(true);
    expect(isMailDeliveryError('RETRY')).toBe(false);
  });
});
