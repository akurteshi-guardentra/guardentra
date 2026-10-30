import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AssessmentTrackerTable } from '../components/assessments/AssessmentTrackerTable';
import type { StoredAssessment } from '../lib/vendor/localAssessmentStore';

function renderTable(rows: StoredAssessment[], onReview = vi.fn(), onOpenPortalLink = vi.fn()) {
  render(
    <MemoryRouter>
      <AssessmentTrackerTable
        search=""
        onSearchChange={() => {}}
        vendorFilter="all"
        onVendorFilterChange={() => {}}
        vendorOptions={[]}
        onClearVendorFilter={() => {}}
        loading={false}
        filtered={rows}
        assessmentsCount={rows.length}
        reminderState={{}}
        isLocalAssessment={() => false}
        onOpenPortalLink={onOpenPortalLink}
        onSendReminder={() => {}}
        onReview={onReview}
        onCreateNew={() => {}}
      />
    </MemoryRouter>
  );
  return { onReview, onOpenPortalLink };
}

const base = {
  vendorId: 'v1',
  vendorName: 'Acme',
  frameworkName: 'SOC 2',
  status: 'Completed',
  progressPct: 100,
} as unknown as StoredAssessment;

describe('AssessmentTrackerTable', () => {
  it('shows a labelled Review button that opens the review', () => {
    const row = { ...base, id: 'a1', status: 'Under Review' } as StoredAssessment;
    const { onReview } = renderTable([row]);
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    expect(onReview).toHaveBeenCalledWith(row);
  });

  it('opens the review when the row itself is clicked', () => {
    const row = { ...base, id: 'a1' } as StoredAssessment;
    const { onReview } = renderTable([row]);
    fireEvent.click(screen.getByText('SOC 2'));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('does not open the review when a row action or link is clicked', () => {
    const row = { ...base, id: 'a1' } as StoredAssessment;
    const { onReview, onOpenPortalLink } = renderTable([row]);
    fireEvent.click(screen.getByTitle('Open Vendor Portal in new tab'));
    fireEvent.click(screen.getByRole('link', { name: 'Acme' }));
    expect(onOpenPortalLink).toHaveBeenCalledTimes(1);
    expect(onReview).not.toHaveBeenCalled();
  });

  it('shows the recorded decision under the status', () => {
    renderTable([
      { ...base, id: 'a1', decisionOutcome: 'rejected' } as StoredAssessment,
      { ...base, id: 'a2', decisionOutcome: 'conditional' } as StoredAssessment,
      { ...base, id: 'a3', status: 'Under Review' } as StoredAssessment,
    ]);
    expect(screen.getByText('Rejected')).toBeTruthy();
    expect(screen.getByText('Conditional')).toBeTruthy();
    expect(screen.queryByText('Approved')).toBeNull();
  });
});
