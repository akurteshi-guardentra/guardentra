import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemediationBoard } from '../components/RemediationBoard';
import { RemediationService, type RemediationTicket } from '../services/RemediationService';

const ticket = (over: Partial<RemediationTicket> = {}): RemediationTicket => ({
  id: 't1', vendorId: 'org-wide', vendorName: 'Acme', finding: 'MFA not enforced',
  severity: 'Critical', businessImpact: '', recommendedFix: 'Enable FIDO2 for admins',
  priority: 'High', dueDate: '2030-01-01', ownerSuggestion: 'Security', requiredEvidence: '',
  problem: '', impact: '', recommendedAction: '', deadline: '', successCriteria: '',
  status: 'Backlog', createdAt: '2026-01-01T00:00:00Z', organizationId: 'org1', ...over,
});

describe('RemediationBoard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders tickets that Audit Lab created — the gap KNOWN_ISSUES #15 described', async () => {
    vi.spyOn(RemediationService, 'getAllTickets').mockResolvedValue([ticket()]);
    render(<RemediationBoard organizationId="org1" />);
    expect(await screen.findByText('MFA not enforced')).toBeInTheDocument();
    expect(screen.getByText('Enable FIDO2 for admins')).toBeInTheDocument();
  });

  it('shows an actionable empty state rather than a blank panel', async () => {
    vi.spyOn(RemediationService, 'getAllTickets').mockResolvedValue([]);
    render(<RemediationBoard organizationId="org1" />);
    expect(await screen.findByText(/No remediation tickets yet/i)).toBeInTheDocument();
  });

  it('flags an overdue ticket, but not one already resolved', async () => {
    vi.spyOn(RemediationService, 'getAllTickets').mockResolvedValue([
      ticket({ id: 'a', dueDate: '2020-01-01' }),
      ticket({ id: 'b', dueDate: '2020-01-01', status: 'Resolved', finding: 'Old but done' }),
    ]);
    render(<RemediationBoard organizationId="org1" />);
    await waitFor(() => expect(screen.getByText(/1 overdue/i)).toBeInTheDocument());
  });

  it('resolves a ticket through the service', async () => {
    vi.spyOn(RemediationService, 'getAllTickets').mockResolvedValue([ticket()]);
    const update = vi.spyOn(RemediationService, 'updateTicketStatus').mockResolvedValue(undefined as never);
    render(<RemediationBoard organizationId="org1" />);
    fireEvent.click(await screen.findByText(/Resolve/i));
    await waitFor(() => expect(update).toHaveBeenCalledWith('t1', 'Resolved'));
  });

  it('hides delete from non-admins', async () => {
    vi.spyOn(RemediationService, 'getAllTickets').mockResolvedValue([ticket()]);
    const { rerender } = render(<RemediationBoard organizationId="org1" canDelete={false} />);
    await screen.findByText('MFA not enforced');
    expect(screen.queryByTitle('Delete ticket')).not.toBeInTheDocument();
    rerender(<RemediationBoard organizationId="org1" canDelete />);
    await waitFor(() => expect(screen.getByTitle('Delete ticket')).toBeInTheDocument());
  });
});
