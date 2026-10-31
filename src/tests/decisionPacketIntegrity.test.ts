import { describe, expect, it } from 'vitest';
import { buildDecisionPacketHtml, NO_DECISION_RECORDED_LABEL } from '../lib/vendor/reportExport';
import { recordedDecisionOutcome } from '../lib/vendor/assessmentLifecycle';

/**
 * #124 finding (2026-10-31): before any decision was recorded, the decision packet
 * printed "Outcome: approved" and "Decided by: <admin> at <now>" from the review
 * form defaults. No report may show an unrecorded decision.
 */
const base = {
  vendorName: 'Acme Vendor',
  assessmentId: 'asm_1',
  frameworksLabel: 'SOC 2',
  exceptions: [{ question: 'MFA?', reason: 'negative', answer: 'No' }],
};

describe('recordedDecisionOutcome', () => {
  it('returns null when nothing is recorded', () => {
    expect(recordedDecisionOutcome({})).toBeNull();
    expect(recordedDecisionOutcome({ decisionOutcome: undefined, decidedAt: undefined })).toBeNull();
  });

  it('requires both a valid outcome and decidedAt', () => {
    expect(recordedDecisionOutcome({ decisionOutcome: 'approved' })).toBeNull();
    expect(recordedDecisionOutcome({ decisionOutcome: 'approved', decidedAt: '  ' })).toBeNull();
    expect(recordedDecisionOutcome({ decisionOutcome: 'bogus', decidedAt: '2026-10-31T00:00:00Z' })).toBeNull();
  });

  it('treats a recorded remediate decision as recorded', () => {
    expect(
      recordedDecisionOutcome({ decisionOutcome: 'remediate', decidedAt: '2026-10-31T00:00:00Z' }),
    ).toBe('remediate');
  });

  it('returns each recorded terminal outcome', () => {
    for (const o of ['approved', 'conditional', 'rejected'] as const) {
      expect(recordedDecisionOutcome({ decisionOutcome: o, decidedAt: '2026-10-31T00:00:00Z' })).toBe(o);
    }
  });
});

describe('decision packet before a decision exists', () => {
  const html = buildDecisionPacketHtml({ ...base, outcome: null });

  it('never prints an outcome such as approved', () => {
    expect(html).not.toMatch(/Outcome:\s*<strong>\s*approved/i);
    expect(html).not.toMatch(/\bapproved\b/i);
    expect(html).toContain(`Outcome: <strong>${NO_DECISION_RECORDED_LABEL}</strong>`);
  });

  it('is marked as a DRAFT and withholds decided-by / decided-at / next review', () => {
    expect(html).toContain('DRAFT');
    expect(html).toContain('No decision has been recorded');
    expect(html).not.toContain('Decided by:');
    expect(html).not.toContain('Next review:');
    expect(html).not.toContain('Residual risk:');
  });

  it('still lists the exceptions so the reviewer can use it as a summary', () => {
    expect(html).toContain('MFA?');
  });

  it('treats an empty outcome string as unrecorded', () => {
    const blank = buildDecisionPacketHtml({ ...base, outcome: '   ' });
    expect(blank).toContain(NO_DECISION_RECORDED_LABEL);
    expect(blank).not.toContain('Decided by:');
  });
});

describe('decision packet after a recorded decision', () => {
  it('prints the recorded outcome and decision fields', () => {
    const html = buildDecisionPacketHtml({
      ...base,
      outcome: 'remediate',
      decidedBy: 'admin@example.com',
      decidedAt: '2026-10-31T10:00:00.000Z',
      residualRiskLevel: 'High',
      remediationOwner: 'Security Team',
      remediationDueAt: '2026-11-30T23:59:59.999Z',
    });
    expect(html).toContain('Outcome: <strong>remediate</strong>');
    expect(html).toContain('Decided by: admin@example.com at 2026-10-31T10:00:00.000Z');
    expect(html).not.toContain('DRAFT');
    expect(html).not.toContain(NO_DECISION_RECORDED_LABEL);
  });
});
