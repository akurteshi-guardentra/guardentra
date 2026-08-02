import { describe, expect, it } from 'vitest';
import { buildVendorReportHtml } from '../lib/vendor/reportExport';
import type { Vendor } from '../lib/vendor/types';

const baseVendor: Vendor = {
  id: 'v1',
  name: 'TechCloud Services',
  category: 'Cloud Services',
  criticality: 'High',
  status: 'Active',
  riskScore: 0,
  organizationId: 'org1',
  createdAt: new Date().toISOString(),
  primaryContactName: 'Sarah Chen',
};

describe('vendor PDF report (print HTML)', () => {
  it('includes vendor identity and an honest not-yet-scored state when riskScore is unset', () => {
    const html = buildVendorReportHtml({ vendor: baseVendor });
    expect(html).toContain('TechCloud Services');
    expect(html).toContain('Sarah Chen');
    expect(html).toContain('not yet scored');
  });

  it('shows the real score once one is stored, not a fabricated number', () => {
    const html = buildVendorReportHtml({ vendor: { ...baseVendor, riskScore: 92 } });
    expect(html).toContain('92');
    expect(html).not.toContain('not yet scored');
  });

  it('escapes vendor-controlled text to prevent HTML injection', () => {
    const html = buildVendorReportHtml({
      vendor: { ...baseVendor, name: '<script>alert(1)</script>' },
      notes: '<img src=x onerror=alert(2)>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('lists attachments when present and a placeholder when not', () => {
    const withAttachments = buildVendorReportHtml({
      vendor: baseVendor,
      attachments: [{ fileName: 'soc2-report.pdf', sizeBytes: 204800, uploadedAt: new Date().toISOString() }],
    });
    expect(withAttachments).toContain('soc2-report.pdf');

    const without = buildVendorReportHtml({ vendor: baseVendor });
    expect(without).toContain('No attachments on file.');
  });
});
