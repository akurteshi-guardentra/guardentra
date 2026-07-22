import { describe, expect, it } from 'vitest';
import { riskLevelFromScore } from '../lib/vendor/risk';
import {
  validateAssessmentWizard,
  validateEvidenceFile,
  validateVendorForm,
} from '../lib/vendor/validators';

describe('vendor validators', () => {
  it('requires vendor name and category', () => {
    expect(validateVendorForm({ name: '', category: 'SaaS', criticality: 'High' })).toMatch(/name/i);
    expect(validateVendorForm({ name: 'Acme', category: '', criticality: 'High' })).toMatch(/category/i);
    expect(validateVendorForm({ name: 'Acme', category: 'SaaS', criticality: 'High' })).toBeNull();
  });

  it('validates contact email when present', () => {
    expect(
      validateVendorForm({
        name: 'Acme',
        category: 'SaaS',
        criticality: 'Medium',
        primaryContactEmail: 'not-an-email',
      })
    ).toMatch(/email/i);
  });

  it('requires vendor and frameworks for wizard', () => {
    expect(validateAssessmentWizard({})).toMatch(/vendor/i);
    expect(validateAssessmentWizard({ vendorId: 'v1', frameworks: [] })).toMatch(/framework/i);
    expect(validateAssessmentWizard({ vendorId: 'v1', frameworks: ['soc2'] })).toBeNull();
  });

  it('rejects oversized evidence', () => {
    const big = new File([new Uint8Array(26 * 1024 * 1024)], 'x.pdf', { type: 'application/pdf' });
    expect(validateEvidenceFile(big)).toMatch(/25MB/i);
    const ok = new File([new Uint8Array(10)], 'policy.pdf', { type: 'application/pdf' });
    expect(validateEvidenceFile(ok)).toBeNull();
  });
});

describe('risk bands', () => {
  it('maps scores to mockup bands', () => {
    expect(riskLevelFromScore(92)).toBe('Critical');
    expect(riskLevelFromScore(81)).toBe('High');
    expect(riskLevelFromScore(55)).toBe('Medium');
    expect(riskLevelFromScore(41)).toBe('Low');
  });
});
