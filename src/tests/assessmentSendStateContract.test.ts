import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('#154 assessment send-state integrity', () => {
  it('atomically couples invite queue, assessment Sent, vendor Sent and durable audit intent', () => {
    const route = read('server/routes/notify.ts');

    expect(route).toContain("resolved.intentType === 'assessment_invite'");
    expect(route).toContain('db.runTransaction(async (tx) =>');
    expect(route).toContain('const queueSnap = await tx.get(ref)');
    expect(route).toContain('const assessmentSnap = await tx.get(assessmentRef)');
    expect(route).toContain("db.collection('vendors').doc(vendorId)");
    expect(route).toContain("materialAuditEventId([");
    expect(route).toContain("'assessment.sent'");
    expect(route).toContain('prepareMaterialAuditIntent(tx, db');
    expect(route).toContain('commitPreparedMaterialAuditIntent(tx, preparedAudit)');
    expect(route).toContain('tx.create(ref, queueDoc)');
    expect(route).toContain("status: 'Sent'");
    expect(route).toContain("assessmentStatus: 'Sent'");
    expect(route).toContain('sentAt,');
    expect(route).toContain("'assessment_not_invitable'");
    expect(route).toContain('currentRecipient !== resolved.recipient.toLowerCase()');
    expect(route).toContain("'assessment_recipient_changed'");
  });

  it('hosted wizard relies on server authority and does not emit duplicate sent audit', () => {
    const wizard = read('src/pages/AssessmentWizard.tsx');

    expect(wizard).toContain("fetch('/api/org/assessment-create'");
    expect(wizard).toContain("await sendNotificationIntent({");
    expect(wizard).not.toContain("eventType: 'assessment.sent'");
    expect(wizard).not.toContain("addDoc(collection(db, 'assessments')");
    expect(wizard).not.toContain('syncVendorAfterAssessmentSent');
    expect(wizard).toContain('Assessment created but not marked Sent; authorized invite could not be queued');
    expect(wizard).toContain('Assessment created as Not Started');
  });

  it('keeps vendor creation state separate from vendor Sent state', () => {
    const sync = read('src/lib/vendor/syncVendorAssessment.ts');

    expect(sync).toContain("assessmentStatus: 'Not Started' as const");
    expect(sync).toContain('export async function syncVendorAfterAssessmentSent');
    expect(sync).toContain("assessmentStatus: 'Sent' as const");
  });
});
