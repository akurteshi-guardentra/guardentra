import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getDoc, onSnapshot } from 'firebase/firestore';

const boundary = vi.hoisted(() => ({
  assessment: {} as Record<string, unknown>,
  mode: 'projected',
  refresh: vi.fn(),
  submit: vi.fn(),
  fetch: vi.fn(),
  session: true,
}));
vi.mock('../firebase', () => ({ db: {}, storage: {}, auth: { currentUser: null } }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  signInWithCustomToken: vi.fn(async () => ({})),
}));
vi.mock('../lib/vendor/portalAuth', () => ({
  getPortalAuth: () => ({}), getPortalDb: () => ({}),
  getPortalAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer synthetic-portal', 'Content-Type': 'application/json' })),
}));
vi.mock('../lib/auditClient', () => ({
  createAuditBatcher: () => ({ enqueue: vi.fn(), flush: vi.fn(async () => {}) }),
}));
import { VendorPortal } from '../pages/VendorPortal';

const editable = () => ({ vendorName: 'Synthetic Vendor', organizationId: 'org-1', vendorId: 'v1',
  status: 'In Progress', portalOpen: true, progressPct: 50,
  questions: [{ id: 'q1', category: 'Company Profile', question: 'MFA enabled?', type: 'yesno', options: ['Yes', 'No'], required: true }],
  answers: { q1: 'Yes' }, comments: { q1: 'Saved vendor context' },
});
beforeEach(() => {
  vi.clearAllMocks();
  boundary.assessment = { vendorName: 'Synthetic Vendor', status: 'Completed', portalOpen: false,
    completedAt: '2026-11-01T00:00:00Z', decisionOutcome: 'approved' };
  boundary.mode = 'projected';
  boundary.session = true;
  boundary.refresh.mockResolvedValue({ ok: true, json: async () => ({ assessment: { evidenceTrustByStoragePath: {} } }) });
  boundary.submit.mockResolvedValue({ ok: true, json: async () => ({ ok: true,
    patch: { completedAt: '2026-11-26T12:00:00Z', status: 'Under Review', portalOpen: false } }) });
  boundary.fetch.mockImplementation(async (url: string, init: unknown) => {
    if (url === '/api/portal/assessment-view') return boundary.refresh(url, init);
    if (url === '/api/portal/submit') return boundary.submit(url, init);
    return { ok: true, status: 200, json: async () => ({ token: 'synthetic',
      ...(boundary.session ? { assessment: boundary.assessment, assessmentReadMode: boundary.mode } : {}),
      branding: { requesterOrgName: 'Synthetic Org' },
    }) };
  });
  vi.stubGlobal('fetch', boundary.fetch);
  vi.mocked(onSnapshot).mockImplementation((() => vi.fn()) as any);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function page() {
  return render(<MemoryRouter initialEntries={['/portal/a']}><Routes>
    <Route path="/portal/:assessmentId" element={<VendorPortal />} />
  </Routes></MemoryRouter>);
}
function pending() {
  boundary.assessment = { ...editable(), evidenceByQuestion: { q1: [{
    fileName: 'policy.pdf', storagePath: 'portal/a/policy.pdf', sizeBytes: 100, contentType: 'application/pdf',
  }] }, evidenceTrustByStoragePath: {} };
}
describe('#124 portal consumes safe projected data', () => {
  it('opens a historical receipt without a raw Firestore read or scan listener', async () => {
    page();
    expect(await screen.findByRole('button', { name: 'Download receipt' })).toBeInTheDocument();
    expect(getDoc).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(boundary.refresh).not.toHaveBeenCalled();
  });
  it('restores an editable historical questionnaire and saved vendor context', async () => {
    boundary.assessment = editable();
    page();
    expect(await screen.findByText('MFA enabled?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Explain controls, exceptions, or compensating measures…')).toHaveValue('Saved vendor context');
    expect(getDoc).not.toHaveBeenCalled();
  });
  it('downloads a receipt without inventing a missing historical submission time', async () => {
    delete boundary.assessment.completedAt;
    let receipt = '';
    vi.stubGlobal('Blob', class { constructor(parts: unknown[]) { receipt = parts.join(''); } });
    const OriginalURL = URL;
    vi.stubGlobal('URL', class extends OriginalURL {
      static createObjectURL() { return 'blob:synthetic-receipt'; }
      static revokeObjectURL() {}
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Download receipt' }));
    expect(receipt).toContain('Submitted at (UTC): Unknown');
    expect(receipt).toContain('Assessment reference: a');
  });
  it('fails closed if the server does not provide the safe projection', async () => {
    boundary.session = false;
    page();
    expect(await screen.findByTestId('portal-service-unreachable')).toBeInTheDocument();
    expect(getDoc).not.toHaveBeenCalled();
  });
  it('preserves a fresh submit and uses its server acknowledgement timestamp in the receipt', async () => {
    boundary.assessment = { ...editable(), attestations: { accuracy: true, authority: true, attestedByName: 'Vendor' } };
    let receipt = '';
    vi.stubGlobal('Blob', class { constructor(parts: unknown[]) { receipt = parts.join(''); } });
    const OriginalURL = URL;
    vi.stubGlobal('URL', class extends OriginalURL {
      static createObjectURL() { return 'blob:synthetic-receipt'; }
      static revokeObjectURL() {}
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Download receipt' }));
    expect(receipt).toContain('Submitted at (UTC): 2026-11-26T12:00:00Z');
    expect(boundary.submit).toHaveBeenCalledOnce();
  });
  it('does not claim a receipt for a malformed successful HTTP response', async () => {
    boundary.assessment = { ...editable(), attestations: { accuracy: true, authority: true, attestedByName: 'Vendor' } };
    boundary.submit.mockResolvedValue({ ok: true, json: async () => ({}) });
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Submission failed. The portal link may not have write access yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download receipt' })).toBeNull();
  });
  it('refreshes legacy scan state with the scoped token and discards a response after unmount', async () => {
    pending();
    let resolve!: (value: unknown) => void;
    boundary.refresh.mockImplementation(() => new Promise(r => { resolve = r; }));
    const view = page();
    await waitFor(() => expect(boundary.refresh).toHaveBeenCalledOnce());
    expect(boundary.refresh).toHaveBeenCalledWith('/api/portal/assessment-view', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer synthetic-portal' }),
      body: JSON.stringify({ assessmentId: 'a' }),
    }));
    expect(onSnapshot).not.toHaveBeenCalled();
    view.unmount();
    await act(async () => resolve({ ok: true, json: async () => ({ assessment: { evidenceTrustByStoragePath: {} } }) }));
    expect(boundary.refresh).toHaveBeenCalledOnce();
  });
  it('preserves the scanner listener for a safe modern document', async () => {
    pending();
    boundary.mode = 'direct';
    page();
    await waitFor(() => expect(onSnapshot).toHaveBeenCalledOnce());
    expect(boundary.refresh).not.toHaveBeenCalled();
  });
  it('shows refresh failure rather than claiming clean evidence', async () => {
    pending();
    boundary.refresh.mockResolvedValue({ ok: false, status: 503 });
    page();
    expect(await screen.findByText('Scan status unavailable. Refresh this page to try again.')).toBeInTheDocument();
    expect(boundary.refresh).toHaveBeenCalledOnce();
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});
