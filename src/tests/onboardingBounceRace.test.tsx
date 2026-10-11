import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Onboarding } from '../pages/Onboarding';
import { isProfileBootstrapped } from '../lib/bootstrapGate';
import {
  __resetOnboardingAcksForTests,
} from '../lib/onboardingAck';
import { clearLocallyOnboarded } from '../lib/onboardingFlag';

/**
 * Issue #67: after secure bootstrap, users are not bounced to the old wizard.
 * Bootstrapped profiles (organizationId) reach Dashboard regardless of onboarded.
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
  acknowledgeDurableOnboarding: () => {},
}));

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    profile: authState.profile,
    loading: authState.loading,
    acknowledgeDurableOnboarding: () => authState.acknowledgeDurableOnboarding(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../lib/firebase-utils', () => ({
  logOut: vi.fn(),
}));

function AppShell() {
  const profile = authState.profile;
  const user = authState.user;
  const loading = authState.loading;
  if (loading || (user && !profile)) return <div>Loading</div>;
  if (!user) return <div>Login</div>;

  const bootstrapped = isProfileBootstrapped(profile);

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={bootstrapped ? <Navigate to="/dashboard" replace /> : <Onboarding />}
      />
      <Route
        path="/dashboard"
        element={
          !bootstrapped ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <div>Dashboard Active</div>
          )
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

  it('missing organizationId does not grant dashboard (no tenant bypass)', async () => {
    authState.profile = { ...authState.profile, organizationId: '' };
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>,
    );
    await waitFor(() => {
      // Redirect target may show loading Onboarding shell
      expect(screen.queryByText('Dashboard Active')).not.toBeInTheDocument();
    });
  });
});
