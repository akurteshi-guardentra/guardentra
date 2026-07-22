import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Onboarding } from '../pages/Onboarding';
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

describe('Onboarding Flow (BDD)', () => {
  it('Scenario: First-time user completes onboarding and activates frameworks', async () => {
    renderWithProviders(<Onboarding />);
    
    // Step 1: Identity
    expect(screen.getByText(/build your security foundation/i)).toBeInTheDocument();
    
    fireEvent.change(screen.getByPlaceholderText(/e.g. Acme Cybersec/i), { target: { value: 'Guardentra Test Org' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SaaS' } });
    
    fireEvent.click(screen.getByText(/Continue to Frameworks/i));
    
    // Step 2: Scope
    await waitFor(() => {
      expect(screen.getByText(/Target Compliance Goals/i)).toBeInTheDocument();
    });
    
    // Select ISO 27001
    fireEvent.click(screen.getByText(/ISO 27001:2022/i));
    
    fireEvent.click(screen.getByText(/Confirm Strategy/i));
    
    // Step 3: Launch
    await waitFor(() => {
      expect(screen.getByText(/Ready to Launch/i)).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText(/Deploy Architecture/i));
    
    // Verify Firestore updates
    await waitFor(() => {
      expect(firestore.updateDoc).toHaveBeenCalled();
      expect(firestore.addDoc).toHaveBeenCalled();
    });
  });
});
