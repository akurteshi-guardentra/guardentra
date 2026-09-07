import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import * as firestore from 'firebase/firestore';
import { Onboarding } from '../pages/Onboarding';
import {
  __resetOnboardingAcksForTests,
  acknowledgeOnboardingComplete,
  clearOnboardingAck,
  hasOnboardingAck,
} from '../lib/onboardingAck';
import { clearLocallyOnboarded, isLocallyOnboarded, setLocallyOnboarded } from '../lib/onboardingFlag';

/**
 * Bugbot race: after durable updateDoc, navigate('/dashboard') while
 * AuthContext profile.onboarded is still false until the listener updates.
 * Session ack + optimistic profile update must prevent ProtectedRoute bounce.
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

vi.mock('../lib/seeding', async () => {
  const actual = await vi.importActual<typeof import('../lib/seeding')>('../lib/seeding');
  return {
    ...actual,
    seedProfessionalData: vi.fn(async () => ({
      skipped: false,
      batchCommits: 1,
      writeCount: 1,
      durationMs: 1,
      sampleSeedVersion: 'v1',
    })),
  };
});

function AppShell() {
  const profile = authState.profile;
  const user = authState.user;
  const loading = authState.loading;
  if (loading || (user && !profile)) return <div>Loading</div>;
  if (!user) return <div>Login</div>;

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          profile?.onboarded || hasOnboardingAck(user.uid) ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Onboarding />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          !profile?.onboarded && !hasOnboardingAck(user.uid) ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <div>Dashboard Active</div>
          )
        }
      />
    </Routes>
  );
}

async function walkToFinish() {
  fireEvent.change(screen.getByPlaceholderText(/e.g. Acme Cybersec/i), {
    target: { value: 'Race Org' },
  });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SaaS' } });
  fireEvent.click(screen.getByText(/Continue to Frameworks/i));
  await waitFor(() => screen.getByText(/ISO 27001:2022/i));
  fireEvent.click(screen.getByText(/ISO 27001:2022/i));
  fireEvent.click(screen.getByText(/Review and finish/i));
  await waitFor(() => screen.getByText(/Finish setup/i));
}

describe('Bugbot onboarding completion bounce race', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetOnboardingAcksForTests();
    clearLocallyOnboarded('race-user');
    clearLocallyOnboarded('other-user');
    authState.user = { uid: 'race-user', email: 'a@example.com', displayName: 'Admin' };
    authState.profile = {
      email: 'a@example.com',
      displayName: 'Admin',
      role: 'admin',
      organizationId: 'org-race',
      onboarded: false,
    };
    authState.loading = false;
    authState.acknowledgeDurableOnboarding = () => {
      acknowledgeOnboardingComplete('race-user');
      setLocallyOnboarded('race-user');
      authState.profile = { ...authState.profile, onboarded: true };
    };
    vi.mocked(firestore.updateDoc).mockResolvedValue(undefined as any);
    vi.mocked(firestore.setDoc).mockResolvedValue(undefined as any);
  });

  it('does NOT bounce to onboarding when profile snapshot lags after durable success', async () => {
    expect(authState.profile.onboarded).toBe(false);

    const { rerender } = render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <AppShell />
      </MemoryRouter>
    );

    await walkToFinish();
    fireEvent.click(screen.getByText(/Finish setup/i));

    await waitFor(() => {
      expect(firestore.updateDoc).toHaveBeenCalled();
      expect(hasOnboardingAck('race-user')).toBe(true);
    });

    // Worst case: in-memory profile still reports false while ack is present
    // (stale listener). ProtectedRoute must honor the session ack.
    act(() => {
      authState.profile = { ...authState.profile, onboarded: false };
    });

    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Active')).toBeInTheDocument();
    });
    expect(screen.queryByText(/set up your workspace/i)).not.toBeInTheDocument();

    act(() => {
      authState.profile = { ...authState.profile, onboarded: true };
      clearOnboardingAck('race-user');
    });
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Active')).toBeInTheDocument();
  });

  it('stale local flag alone cannot bypass cloud false without session ack', () => {
    setLocallyOnboarded('race-user');
    expect(isLocallyOnboarded('race-user')).toBe(true);
    expect(hasOnboardingAck('race-user')).toBe(false);
    authState.profile = { ...authState.profile, onboarded: false };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>
    );

    expect(screen.queryByText('Dashboard Active')).not.toBeInTheDocument();
  });

  it('account switch cannot reuse another uid completion acknowledgement', () => {
    acknowledgeOnboardingComplete('race-user');
    expect(hasOnboardingAck('race-user')).toBe(true);
    expect(hasOnboardingAck('other-user')).toBe(false);

    authState.user = { uid: 'other-user', email: 'b@example.com', displayName: 'Other' };
    authState.profile = {
      email: 'b@example.com',
      displayName: 'Other',
      role: 'admin',
      organizationId: 'org-other',
      onboarded: false,
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>
    );

    expect(screen.queryByText('Dashboard Active')).not.toBeInTheDocument();
  });
});
