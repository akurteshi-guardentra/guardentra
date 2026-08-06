import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

function Layout({ children }: { children: React.ReactNode }) {
  return <div data-testid="layout">{children}</div>;
}

describe('nested route ranking for triage', () => {
  it('matches /assessments/triage to triage, not assessments or catch-all', () => {
    render(
      <MemoryRouter initialEntries={['/assessments/triage?vendorId=abc']}>
        <Routes>
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/assessments" element={<div>ASSESSMENTS_PAGE</div>} />
                  <Route path="/assessments/triage" element={<div>TRIAGE_PAGE</div>} />
                  <Route path="/assessments/new" element={<div>WIZARD_PAGE</div>} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<div>DASHBOARD</div>} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('TRIAGE_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('ASSESSMENTS_PAGE')).not.toBeInTheDocument();
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
  });
});
