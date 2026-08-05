import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Dashboard } from '../pages/Dashboard';
import { AuthProvider } from '../lib/AuthContext';
import { MemoryRouter } from 'react-router-dom';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
};

describe('Dashboard (BDD)', () => {
  it('Scenario: User sees vendor spine CTAs without dashboard theater', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Pending assessments/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Assessment/i })).toBeInTheDocument();
    expect(screen.queryByText(/Operator Action Center/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/War Room/i)).not.toBeInTheDocument();
  });
});
