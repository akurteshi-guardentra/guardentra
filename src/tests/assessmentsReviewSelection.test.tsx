import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { StoredAssessment } from '../lib/vendor/localAssessmentStore';
import { openDecisionPacketForPrint } from '../lib/vendor/reportExport';

const state = vi.hoisted(() => ({
  orgId: 'org-1',
  reviewOverlay: 'loading' as 'loading' | 'ready' | 'error',
  assessments: [] as StoredAssessment[],
}));

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'reviewer-1' },
    profile: { organizationId: state.orgId, displayName: 'Org Admin', email: 'admin@org.example' },
    loading: false,
  }),
}));

vi.mock('../lib/vendor/useOrgAssessments', () => ({
  useOrgAssessments: () => ({
    assessments: state.assessments,
    mode: 'firestore',
    loading: false,
    reviewOverlay: state.reviewOverlay,
    refreshLocal: vi.fn(),
    retryFirestore: vi.fn(),
  }),
}));

vi.mock('../lib/vendor/useOrgVendors', () => ({
  useOrgVendors: () => ({ vendors: [] }),
}));

vi.mock('../lib/vendor/orgFrameworkPacks', () => ({
  loadOrgFrameworkPackDefaults: vi.fn(async () => ({})),
}));

vi.mock('../lib/vendor/reportExport', async () => {
  const actual = await vi.importActual<typeof import('../lib/vendor/reportExport')>(
    '../lib/vendor/reportExport',
  );
  return { ...actual, openDecisionPacketForPrint: vi.fn() };
});

import { Assessments } from '../pages/Assessments';

function row(extra: Partial<StoredAssessment> = {}): StoredAssessment {
  return {
    id: 'asm-1',
    vendorId: 'v1',
    vendorName: 'Visible Vendor',
    organizationId: 'org-1',
    frameworkName: 'SOC 2',
    status: 'Completed',
    progressPct: 100,
    decisionOutcome: 'approved',
    decidedAt: '2026-11-24T12:00:00.000Z',
    portalOpen: false,
    questions: [{ id: 'q1', question: 'MFA?', required: true }],
    ...extra,
  } as StoredAssessment;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Assessments />
    </MemoryRouter>,
  );
}

describe('Assessments review selection follows the latest same-org record', () => {
  beforeEach(() => {
    state.orgId = 'org-1';
    state.reviewOverlay = 'loading';
    state.assessments = [row()];
    vi.mocked(openDecisionPacketForPrint).mockClear();
  });

  it('shows and exports private fields that arrive after the review was opened', async () => {
    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(
      await screen.findByText('Loading — not a complete decision record', {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download decision PDF' }));
    expect(openDecisionPacketForPrint).not.toHaveBeenCalled();
    expect(screen.getByText(/still loading/)).toBeInTheDocument();

    state.reviewOverlay = 'ready';
    state.assessments = [
      row({
        decisionNotes: 'internal note',
        residualRiskLevel: 'High',
        decidedByName: 'Rae Reviewer',
        remediationOwner: 'Security',
      }),
    ];
    view.rerender(
      <MemoryRouter>
        <Assessments />
      </MemoryRouter>,
    );

    expect(await screen.findByText('internal note')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download decision PDF' }));
    expect(openDecisionPacketForPrint).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: 'asm-1',
        outcome: 'approved',
        decisionNotes: 'internal note',
        residualRiskLevel: 'High',
        remediationOwner: 'Security',
      }),
    );
  });

  it('keeps an unsaved decision note when the public row refreshes', async () => {
    state.assessments = [
      row({
        status: 'In Progress',
        progressPct: 40,
        decisionOutcome: undefined,
        decidedAt: undefined,
      }),
    ];
    state.reviewOverlay = 'ready';
    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const notes = await screen.findByPlaceholderText('Optional notes for the audit trail…');
    fireEvent.change(notes, { target: { value: 'draft note' } });

    state.assessments = [
      row({
        status: 'In Progress',
        progressPct: 40,
        decisionOutcome: undefined,
        decidedAt: undefined,
        vendorName: 'Visible Vendor',
        answers: { q1: 'Yes' },
      }),
    ];
    view.rerender(
      <MemoryRouter>
        <Assessments />
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText('Optional notes for the audit trail…')).toHaveValue('draft note');
  });

  it('does not export a recorded packet when the reviewer listen failed', async () => {
    state.reviewOverlay = 'error';
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText(/Unavailable — not a complete decision record/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download decision PDF' }));
    expect(openDecisionPacketForPrint).not.toHaveBeenCalled();
    expect(screen.getByText(/Reviewer record unavailable/)).toBeInTheDocument();
  });

  it('cannot export the prior record after it disappears or the organization changes', async () => {
    state.reviewOverlay = 'ready';
    state.assessments = [row({ decisionNotes: 'internal note', residualRiskLevel: 'High' })];
    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText('internal note')).toBeInTheDocument();

    state.assessments = [];
    view.rerender(
      <MemoryRouter>
        <Assessments />
      </MemoryRouter>,
    );
    expect(screen.queryByText('internal note')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download decision PDF' })).toBeNull();
    expect(openDecisionPacketForPrint).not.toHaveBeenCalled();

    state.assessments = [row({ decisionNotes: 'internal note', residualRiskLevel: 'High' })];
    view.rerender(
      <MemoryRouter>
        <Assessments />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText('internal note')).toBeInTheDocument();
    state.orgId = 'org-2';
    state.assessments = [
      row({
        id: 'asm-1',
        organizationId: 'org-2',
        decisionNotes: 'other org',
        vendorName: 'Other Org Vendor',
      }),
    ];
    view.rerender(
      <MemoryRouter>
        <Assessments />
      </MemoryRouter>,
    );
    expect(screen.queryByText('internal note')).toBeNull();
    const download = screen.queryByRole('button', { name: 'Download decision PDF' });
    if (download) fireEvent.click(download);
    if (vi.mocked(openDecisionPacketForPrint).mock.calls.length > 0) {
      expect(openDecisionPacketForPrint).not.toHaveBeenCalledWith(
        expect.objectContaining({ decisionNotes: 'internal note' }),
      );
      expect(openDecisionPacketForPrint).toHaveBeenCalledWith(
        expect.objectContaining({ decisionNotes: 'other org' }),
      );
    }
  });
});
