import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from '../pages/Dashboard';
import { AuthProvider } from '../lib/AuthContext';
import { MemoryRouter } from 'react-router-dom';

// Wrapper for common providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('Dashboard (BDD)', () => {
  it('Scenario: User logs in and views their risk summary', async () => {
    // Given the user is authenticated (mocked in vitest.setup.ts)
    
    // When they navigate to the Dashboard
    renderWithProviders(<Dashboard />);
    
    // Then they should see the AI Briefing status initially
    expect(screen.getByText(/Aggregating regulatory telemetry/i)).toBeInTheDocument();
    
    // And finally see the AI Briefing content after generation
    await waitFor(() => {
      expect(screen.getByText(/Mocked AI Briefing/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // And see the key stats
    expect(screen.getByText(/Value at Risk \(Est\.\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Compliance Readiness/i)).toBeInTheDocument();
  });
});
