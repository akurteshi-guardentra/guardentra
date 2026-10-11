import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('#154 assessment send-state integrity', () => {
  it('atomically couples initial invite queue acceptance with the assessment Sent marker', () => {
    const route = read('server/routes/notify.ts');

    expect(route).toContain("resolved.intentType === 'assessment_invite'");
    expect(route).toContain('db.runTransaction(async (tx) =>');
    expect(route).toContain('const queueSnap = await tx.get(ref)');
    expect(route).toContain('const assessmentSnap = await tx.get(assessmentRef)');
    expect(route).toContain('tx.create(ref, queueDoc)');
    expect(route).toContain("status: 'Sent'");
    expect(route).toContain('sentAt,');
    expect(route).toContain("'assessment_not_invitable'");
  });

  it('emits assessment.sent only after notification queue acceptance', () => {
    const wizard = read('src/pages/AssessmentWizard.tsx');
    const queueIndex = wizard.indexOf("await sendNotificationIntent({");
    const auditIndex = wizard.indexOf("eventType: 'assessment.sent'");

    expect(queueIndex).toBeGreaterThan(-1);
    expect(auditIndex).toBeGreaterThan(queueIndex);
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
