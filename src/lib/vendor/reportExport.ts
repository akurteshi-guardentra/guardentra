import { displayRiskScore, effectiveRiskLevel, hasRealRiskScore } from './risk';
import type { RiskLevel, Vendor, VendorAssessment } from './types';

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
    '- This register export is markdown; use the per-vendor PDF report (Impact page) for a single-vendor audit artifact.',
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface VendorReportAttachment {
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface VendorReportInput {
  vendor: Vendor;
  impactLevel?: RiskLevel;
  notes?: string;
  attachments?: VendorReportAttachment[];
}

/**
 * Single-vendor PDF report (Cynomi calls this "Report" on the vendor detail page).
 * No PDF library is bundled in this project, so this renders a clean, print-only HTML
 * document and drives the browser's native print dialog — "Save as PDF" there produces
 * an equivalent artifact without adding a new client dependency.
 */
export function buildVendorReportHtml(input: VendorReportInput): string {
  const { vendor, impactLevel, notes, attachments = [] } = input;
  const level = effectiveRiskLevel(vendor);
  const scoreLine = hasRealRiskScore(vendor) ? `${displayRiskScore(vendor)} · ${level}` : `${level} (not yet scored)`;
  const generated = new Date().toLocaleString();

  const attachmentRows = attachments.length
    ? attachments
        .map(
          (a) =>
            `<tr><td>${escapeHtml(a.fileName)}</td><td>${(a.sizeBytes / 1024).toFixed(0)} KB</td><td>${escapeHtml(new Date(a.uploadedAt).toLocaleDateString())}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="3" class="muted">No attachments on file.</td></tr>';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(vendor.name)} — Vendor Report</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 40px; }
  h1 { font-size: 20px; margin-bottom: 0; }
  .subtitle { color: #555; margin-top: 4px; font-size: 13px; }
  .section { margin-top: 24px; }
  .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  .muted { color: #888; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid #ccc; font-size: 12px; font-weight: 600; }
  @media print { body { margin: 0.5in; } }
</style>
</head>
<body>
  <h1>${escapeHtml(vendor.name)}</h1>
  <p class="subtitle">Vendor Risk Report · Generated ${escapeHtml(generated)}</p>

  <div class="section">
    <h2>Profile</h2>
    <table>
      <tr><th>Category</th><td>${escapeHtml(vendor.category || '—')}</td></tr>
      <tr><th>Criticality</th><td>${escapeHtml(vendor.criticality || '—')}</td></tr>
      <tr><th>Primary contact</th><td>${escapeHtml(vendor.primaryContactName || vendor.primaryContactEmail || '—')}</td></tr>
      <tr><th>Risk</th><td><span class="badge">${escapeHtml(scoreLine)}</span></td></tr>
      ${impactLevel ? `<tr><th>Impact level</th><td>${escapeHtml(impactLevel)}</td></tr>` : ''}
    </table>
  </div>

  ${
    notes
      ? `<div class="section"><h2>Impact Notes</h2><p>${escapeHtml(notes)}</p></div>`
      : ''
  }

  <div class="section">
    <h2>Attachments</h2>
    <table>
      <tr><th>File</th><th>Size</th><th>Uploaded</th></tr>
      ${attachmentRows}
    </table>
  </div>

  <p class="subtitle" style="margin-top: 32px;">Generated by Guardentra — Vendor TPRM.</p>
</body>
</html>`;
}

export function openVendorReportForPrint(input: VendorReportInput): void {
  const html = buildVendorReportHtml(input);
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    throw new Error('Report window was blocked. Allow pop-ups for this site to download the PDF.');
  }
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  // document.write doesn't reliably fire `load` across browsers; a short delay lets
  // layout/fonts settle before the print dialog opens (which the user can Save as PDF from).
  setTimeout(() => {
    reportWindow.print();
  }, 300);
}
