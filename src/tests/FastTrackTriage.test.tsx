import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    profile: { organizationId: 'org1', role: 'admin' },
    user: { uid: 'u1' },
    loading: false,
  }),
}));

vi.mock('../lib/vendor/useOrgVendors', () => ({
  useOrgVendors: () => ({
    vendors: [{ id: 'hfUsJZsOBZ9JiD6vuQGr', name: 'Test Vendor', category: 'SaaS' }],
    loading: false,
    mode: 'firestore',
  }),
}));

import { FastTrackTriage } from '../pages/FastTrackTriage';

describe('FastTrackTriage blank-page regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders first triage question when vendorId is in the query', () => {
    render(
      <MemoryRouter initialEntries={['/assessments/triage?vendorId=hfUsJZsOBZ9JiD6vuQGr']}>
        <Routes>
          <Route path="/assessments/triage" element={<FastTrackTriage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Risk triage')).toBeInTheDocument();
    expect(screen.getByText(/Triaging/i)).toBeInTheDocument();
    expect(screen.getByText('Test Vendor')).toBeInTheDocument();
    expect(
      screen.getByText('What type of information can this vendor access or process?')
    ).toBeInTheDocument();
  });

  it('shows a recovery path when the vendorId is missing from the org list', () => {
    render(
      <MemoryRouter initialEntries={['/assessments/triage?vendorId=missing']}>
        <Routes>
          <Route path="/assessments/triage" element={<FastTrackTriage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Risk triage')).toBeInTheDocument();
    expect(screen.getByText(/Vendor not found in this organization/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Vendors/i })).toBeInTheDocument();
  });
});
