import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('#158 portal submit durable audit coupling', () => {
  it('routes portal submission through the server handler', () => {
    const route = read('server/routes/portal.ts');
    expect(route).toContain("router.post('/submit'");
    expect(route).toContain('handlePortalSubmit(req, res, evidenceDeps)');
  });

  it('removes direct product mutation and best-effort assessment.submitted audit from handleSubmit', () => {
    const portal = read('src/pages/VendorPortal.tsx');
    const start = portal.indexOf('const handleSubmit = async () => {');
    const end = portal.indexOf('\n  const goNext', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const submit = portal.slice(start, end);
    expect(submit).toContain("fetch('/api/portal/submit'");
    expect(submit).not.toContain("updateDoc(doc(db, 'assessments', assessmentId)");
    expect(submit).not.toContain("eventType: 'assessment.submitted'");
  });

  it('keeps vendor status as a post-submit projection rather than the authoritative transition', () => {
    const portal = read('src/pages/VendorPortal.tsx');
    const start = portal.indexOf('const handleSubmit = async () => {');
    const end = portal.indexOf('\n  const goNext', start);
    const submit = portal.slice(start, end);

    const serverIndex = submit.indexOf("fetch('/api/portal/submit'");
    const vendorSyncIndex = submit.indexOf('syncVendorAfterAssessmentSubmit');
    expect(serverIndex).toBeGreaterThan(-1);
    expect(vendorSyncIndex).toBeGreaterThan(serverIndex);
  });
});
