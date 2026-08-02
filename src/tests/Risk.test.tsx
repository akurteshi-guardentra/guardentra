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
    
    expect(screen.getByRole('heading', { name: /Risk Intelligence/i })).toBeInTheDocument();
    
    const detectBtn = screen.getByText(/Auto-Detect Risks/i);
    fireEvent.click(detectBtn);
    
    await waitFor(() => {
      expect(screen.getByText(/Scanning.../i)).toBeInTheDocument();
    });
  });

  it('should allow a user to manually add a risk', async () => {
    renderWithProviders(<RiskManagement />);
    
    fireEvent.click(screen.getByRole('button', { name: /Add Risk/i }));

    const titleField = await screen.findByPlaceholderText(/e\.g\., Unathorized access/i);
    fireEvent.change(titleField, { target: { value: 'Vendor access risk' } });

    const form = titleField.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    
    await waitFor(() => {
      expect(firestore.addDoc).toHaveBeenCalled();
    });
  });
});
