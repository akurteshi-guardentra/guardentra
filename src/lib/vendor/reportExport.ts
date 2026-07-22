import { effectiveRiskLevel } from './risk';
import type { Vendor, VendorAssessment } from './types';

/** Client-ready third-party risk summary (markdown). Gap vs Cynomi: PDF later. */
export function buildVendorRegisterMarkdown(
  vendors: Vendor[],
  assessments: VendorAssessment[] = []
): string {
  const byVendor = new Map<string, VendorAssessment[]>();
  for (const a of assessments) {
    const list = byVendor.get(a.vendorId) || [];
    list.push(a);
    byVendor.set(a.vendorId, list);
  }

  const lines: string[] = [
    '# Third-Party Risk Register',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Vendors: ${vendors.length}`,
    '',
    '| Vendor | Category | Criticality | Risk score | Assessment | Contact |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const v of vendors) {
    const level = effectiveRiskLevel(v);
    const assessmentsForVendor = byVendor.get(v.id) || [];
    const latest = assessmentsForVendor[0];
    const assessmentLabel =
      latest?.status || v.assessmentStatus || 'Not Started';
    const contact = v.primaryContactEmail || v.primaryContactName || '—';
    lines.push(
      `| ${escapeCell(v.name)} | ${escapeCell(v.category)} | ${level} | ${v.riskScore || '—'} | ${escapeCell(assessmentLabel)} | ${escapeCell(contact)} |`
    );
  }

  lines.push('', '## Notes', '');
  lines.push(
    '- Risk bands: Critical ≥85, High ≥70, Medium ≥50, Low &lt;50 (when score is set).',
    '- Criticality is the business impact tier; score reflects assessment outcomes when available.',
    '- Export is markdown for audit packs; PDF export is planned.',
    ''
  );

  return lines.join('\n');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadVendorRegisterReport(vendors: Vendor[], assessments?: VendorAssessment[]): void {
  const md = buildVendorRegisterMarkdown(vendors, assessments);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadMarkdown(`guardentra-tprm-register-${stamp}.md`, md);
}
