import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('#168 FastTrack durable audit coupling contract', () => {
  it('routes hosted FastTrack acceptance through the server boundary', () => {
    const page = read('src/pages/FastTrackTriage.tsx');
    const start = page.indexOf('const acceptRecommendation = async () => {');
    const end = page.indexOf('\n  const openAdvanced', start);
    const accept = page.slice(start, end);

    expect(accept).toContain("fetch('/api/org/vendor-triage'");
    const hostedStart = accept.indexOf("fetch('/api/org/vendor-triage'");
    expect(accept.slice(hostedStart)).not.toContain('emitAuditBestEffort');
    expect(accept).not.toContain("updateDoc(doc(db, 'vendors'");
  });

  it('keeps local vendor triage browser-local rather than reopening Firestore writes', () => {
    const store = read('src/lib/vendor/vendorTriageStore.ts');
    expect(store).toContain("record.vendorId.startsWith('local_')");
    expect(store).toContain('localStorage.setItem');
    expect(store).toContain("vendorId.startsWith('local_')");
    expect(store).toContain('localStorage.getItem');
  });

  it('closes direct hosted vendor_triage writes in Firestore rules', () => {
    const rules = read('firestore.rules');
    const start = rules.indexOf('match /vendor_triage/{vendorId}');
    const end = rules.indexOf('match /vendor_assessments/{assessmentId}', start);
    const block = rules.slice(start, end);

    expect(block).toContain('allow read: if isDocOrgMember();');
    expect(block).toContain('allow create, update, delete: if false;');
  });

  it('exposes one authenticated org server route for authoritative triage', () => {
    const route = read('server/routes/orgEvidence.ts');
    expect(route).toContain("router.post('/vendor-triage'");
    expect(route).toContain('handleOrgVendorTriage(req, res)');
  });
});
