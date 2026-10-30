import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../AppAuthenticated';
import { Onboarding } from '../pages/Onboarding';
import {
  __resetOnboardingAcksForTests,
} from '../lib/onboardingAck';
import { clearLocallyOnboarded } from '../lib/onboardingFlag';

/**
 * Issue #67: after secure bootstrap, users are not bounced to the old wizard.
 * Bootstrapped profiles (organizationId) reach Dashboard regardless of onboarded.
 * Unbound organizationId uses BootstrapRecoveryPanel — never indefinite spinner.
 */

const authState = vi.hoisted(() => ({
  user: { uid: 'race-user', email: 'a@example.com', displayName: 'Admin' } as any,
  profile: {
    email: 'a@example.com',
    displayName: 'Admin',
    role: 'admin',
    organizationId: 'org-race',
    onboarded: false,
  } as any,
  loading: false,
  profileError: null as string | null,
  retryProfileLoad: vi.fn(),
  acknowledgeDurableOnboarding: () => {},
}));

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    profile: authState.profile,
    loading: authState.loading,
    profileError: authState.profileError,
    retryProfileLoad: () => authState.retryProfileLoad(),
    acknowledgeDurableOnboarding: () => authState.acknowledgeDurableOnboarding(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../lib/firebase-utils', () => ({
  logOut: vi.fn(),
}));

function AppShell() {
  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <div>Dashboard Active</div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

describe('Issue #67 bootstrap → dashboard (no wizard bounce)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetOnboardingAcksForTests();
    clearLocallyOnboarded('race-user');
    authState.user = { uid: 'race-user', email: 'a@example.com', displayName: 'Admin' };
    authState.profile = {
      email: 'a@example.com',
      displayName: 'Admin',
      role: 'admin',
      organizationId: 'org-race',
      onboarded: false,
    };
    authState.loading = false;
  });

  it('bootstrapped user with onboarded=false reaches dashboard', async () => {
    expect(authState.profile.onboarded).toBe(false);
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard Active')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Step 1 of 3/i)).not.toBeInTheDocument();
  });

  it('legacy /onboarding redirects bootstrapped users to dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <AppShell />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard Active')).toBeInTheDocument();
    });
  });

  it('missing organizationId shows recovery UI, not spinner or Dashboard', async () => {
    authState.profile = { ...authState.profile, organizationId: '' };
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('bootstrap-recovery-panel')).toBeInTheDocument();
    });
    expect(screen.queryByText('Dashboard Active')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });
});
