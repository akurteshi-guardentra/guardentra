import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('#163 server-authoritative material transition contract', () => {
  it('closes direct client create and portal-submit bypasses in Firestore rules', () => {
    const rules = read('firestore.rules');

    const vendorBlock = rules.slice(
      rules.indexOf('match /vendors/{vendorId}'),
      rules.indexOf('match /vendor_invites/{inviteId}'),
    );
    expect(vendorBlock).toContain('allow create: if false;');

    const assessmentBlock = rules.slice(
      rules.indexOf('match /assessments/{assessmentId}'),
      rules.indexOf('match /assessment_responses/{responseId}'),
    );
    expect(assessmentBlock).toContain('allow create: if false;');
    expect(assessmentBlock).not.toContain('portalSubmitTransition()');
    expect(assessmentBlock).not.toContain('portalSubmitFieldsChanged()');
    expect(assessmentBlock).toContain('portalAutosaveStateValid()');
    expect(rules).toContain("match /audit_material_intents/{eventId}");
    expect(rules).toContain('allow read, write: if false;');

    const inviteBlock = rules.slice(
      rules.indexOf('match /vendor_invites/{inviteId}'),
      rules.indexOf('match /vendor_triage/{vendorId}'),
    );
    expect(inviteBlock).toContain('allow create: if false;');
  });

  it('hosted create paths use server routes rather than direct addDoc', () => {
    const vendors = read('src/pages/VendorsDirectory.tsx');
    const wizard = read('src/pages/AssessmentWizard.tsx');

    expect(vendors).toContain("fetch('/api/org/vendor-create'");
    expect(wizard).toContain("fetch('/api/org/assessment-create'");
    expect(wizard).not.toContain("addDoc(collection(db, 'assessments')");
  });

  it('local promotion cannot reopen production client-create authority', () => {
    const vendors = read('src/lib/vendor/useOrgVendors.ts');
    const assessments = read('src/lib/vendor/useOrgAssessments.ts');

    expect(vendors).not.toContain("addDoc(collection(db, 'vendors')");
    expect(vendors).toContain("fetch('/api/org/vendor-create'");
    expect(assessments).not.toContain("addDoc(collection(db, 'assessments')");
    expect(assessments).toContain("fetch('/api/org/assessment-create'");
    expect(assessments).toContain('local assessment has material state; leaving it local');
  });

  it('vendor welcome audit truth is server-owned, not browser-authored', () => {
    const vendors = read('src/pages/VendorsDirectory.tsx');
    const notify = read('server/routes/notify.ts');

    expect(vendors).not.toContain("addDoc(collection(db, 'vendor_invites')");
    expect(vendors).not.toContain("eventType: 'vendor.invite_queued'");
    expect(notify).toContain("resolved.intentType === 'vendor_welcome'");
    expect(notify).toContain("db.collection('vendor_invites').doc(resolved.queueId)");
    expect(notify).toContain("'vendor_recipient_changed'");
    expect(notify).toContain("eventType: 'vendor.invite_queued'");
    expect(notify).toContain('commitPreparedMaterialAuditIntent(tx, preparedAudit)');
  });

  it('portal final submit is server-only while autosave stays client-scoped', () => {
    const portal = read('src/pages/VendorPortal.tsx');
    const lifecycle = read('src/lib/vendor/assessmentLifecycle.ts');

    expect(portal).toContain("fetch('/api/portal/submit'");
    expect(portal).not.toContain('syncVendorAfterAssessmentSubmit');
    expect(lifecycle).not.toMatch(/status: 'Sent' \| 'In Progress';\s*questions:/);
  });
});
