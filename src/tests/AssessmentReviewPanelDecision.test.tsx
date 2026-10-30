import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssessmentReviewPanel } from '../components/assessments/AssessmentReviewPanel';
import type { StoredAssessment } from '../lib/vendor/localAssessmentStore';

function renderPanel(assessment: Partial<StoredAssessment>, extra: { decidedByLabel?: string } = {}) {
  const onDecide = vi.fn();
  render(
    <AssessmentReviewPanel
      assessment={{
        id: 'a1',
        vendorId: 'v1',
        vendorName: 'Acme',
        frameworkName: 'SOC 2',
        status: 'Under Review',
        progressPct: 100,
        questions: [{ id: 'q1', category: 'Access Control', question: 'MFA enforced?', required: true }],
        answers: { q1: 'Yes' },
        ...assessment,
      } as unknown as StoredAssessment}
      reviewAnalysis={null}
      decidedByLabel={extra.decidedByLabel}
      reviewAiError=""
      reviewAiLoading={false}
      reviewFilter="exceptions"
      onReviewFilterChange={() => {}}
      reviewExceptions={[]}
      decisionNotes=""
      onDecisionNotesChange={() => {}}
      decisionOutcome="rejected"
      onDecisionOutcomeChange={() => {}}
      remediationOwner=""
      onRemediationOwnerChange={() => {}}
      remediationDueDate=""
      onRemediationDueDateChange={() => {}}
      residualRiskLevel="Medium"
      onResidualRiskLevelChange={() => {}}
      archiveReason=""
      onArchiveReasonChange={() => {}}
      approving={false}
      recoveringEmpty={false}
      archivingEmpty={false}
      orgPackDefaults={{} as any}
      isLocal={false}
      onClose={() => {}}
      onOpenPortalLink={() => {}}
      onRecoverEmpty={() => {}}
      onArchiveEmpty={() => {}}
      onDecide={onDecide}
    />
  );
  return { onDecide };
}

describe('AssessmentReviewPanel decision area', () => {
  it('offers the decision terminal while no decision is recorded', () => {
    renderPanel({});
    expect(screen.getByText('Decision Terminal')).toBeTruthy();
    expect(screen.getByRole('button', { name: /reject & close/i })).toBeTruthy();
  });

  it('shows a read-only recorded decision once a terminal decision exists', () => {
    renderPanel({
      status: 'Completed',
      decisionOutcome: 'rejected',
      decidedBy: 'owner@example.com',
      decidedAt: '2026-10-26T20:49:00.000Z',
      residualRiskLevel: 'High',
      decisionNotes: 'Missing SOC 2 Type II',
    } as Partial<StoredAssessment>);
    expect(screen.queryByText('Decision Terminal')).toBeNull();
    expect(screen.queryByRole('button', { name: /reject & close|approve & close/i })).toBeNull();
    expect(screen.getByText('Decision recorded')).toBeTruthy();
    expect(screen.getByText('Rejected')).toBeTruthy();
    expect(screen.getByText('owner@example.com')).toBeTruthy();
    expect(screen.getByText('Missing SOC 2 Type II')).toBeTruthy();
  });

  it('shows the decider label instead of a raw user id', () => {
    renderPanel(
      {
        status: 'Completed',
        decisionOutcome: 'rejected',
        decidedBy: 'ivEm7pV6nxNXm6hh6JWMd4rtB6M2',
        decidedAt: '2026-10-26T20:49:00.000Z',
        residualRiskLevel: 'Medium',
      } as Partial<StoredAssessment>,
      { decidedByLabel: 'Dana Reviewer' },
    );
    expect(screen.getByText('Dana Reviewer')).toBeTruthy();
    expect(screen.queryByText('ivEm7pV6nxNXm6hh6JWMd4rtB6M2')).toBeNull();
  });

  it('keeps the terminal open for remediate, which is not a final decision', () => {
    renderPanel({ decisionOutcome: 'remediate' } as Partial<StoredAssessment>);
    expect(screen.getByText('Decision Terminal')).toBeTruthy();
  });
});
