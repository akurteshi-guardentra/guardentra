import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RiskManagement } from '../pages/RiskManagement';
import { AuthProvider } from '../lib/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import * as firestore from 'firebase/firestore';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('Risk Management (TDD)', () => {
  it('should allow a user to trigger auto-detection', async () => {
    renderWithProviders(<RiskManagement />);
    
    // Check if page loads
    expect(screen.getByRole('heading', { name: /Risk Intelligence/i })).toBeInTheDocument();
    
    // Find the Auto-Detect button
    const detectBtn = screen.getByText(/Auto-Detect Risks/i);
    fireEvent.click(detectBtn);
    
    // Verify it shows Scanning...
    await waitFor(() => {
      expect(screen.getByText(/Scanning.../i)).toBeInTheDocument();
    });
  });

  it('should allow a user to manually add a risk', async () => {
    renderWithProviders(<RiskManagement />);
    
    const addBtn = screen.getByRole('button', { name: /Add Risk/i });
    fireEvent.click(addBtn);
    
    // The current implementation of handleAddRisk in the code adds a default risk directly
    await waitFor(() => {
      expect(firestore.addDoc).toHaveBeenCalled();
    });
  });
});
