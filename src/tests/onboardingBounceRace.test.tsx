import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import * as firestore from 'firebase/firestore';
import { Onboarding } from '../pages/Onboarding';
import { __resetOnboardingAcksForTests, acknowledgeOnboardingComplete, clearOnboardingAck, hasOnboardingAck } from '../lib/onboardingAck';
import { clearLocallyOnboarded, isLocallyOnboarded, setLocallyOnboarded } from '../lib/onboardingFlag';

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
    acknowledgeDurableOnboarding: authState.acknowledgeDurableOnboarding,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../lib/firebase-utils', () => ({ logOut: vi.fn() }));

function AppShell() {
  useLocation(); // subscribe harness to navigation so gate inputs are recomputed after Onboarding navigate()
  const profile = authState.profile;
  const user = authState.user;
  const loading = authState.loading;
  if (loading || (user && !profile)) return <div>Loading</div>;
  if (!user) return <div>Login</div>;
  return (
    <Routes>
      <Route path="/onboarding" element={profile?.onboarded || hasOnboardingAck(user.uid) ? <Navigate to="/dashboard" replace /> : <Onboarding />} />
      <Route path="/dashboard" element={!profile?.onboarded && !hasOnboardingAck(user.uid) ? <Navigate to="/onboarding" replace /> : <div>Dashboard Active</div>} />
    </Routes>
  );
}

describe('#67 onboarding completion bounce race', () => {
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
  });

  it('does not bounce when cloud profile lags after durable automatic completion', async () => {
    const { rerender } = render(<MemoryRouter initialEntries={['/onboarding']}><AppShell /></MemoryRouter>);
    await waitFor(() => {
      expect(firestore.updateDoc).toHaveBeenCalled();
      expect(hasOnboardingAck('race-user')).toBe(true);
      expect(screen.getByText('Dashboard Active')).toBeInTheDocument();
    });
    act(() => { authState.profile = { ...authState.profile, onboarded: false }; });
    rerender(<MemoryRouter initialEntries={['/dashboard']}><AppShell /></MemoryRouter>);
    expect(screen.getByText('Dashboard Active')).toBeInTheDocument();
    act(() => {
      authState.profile = { ...authState.profile, onboarded: true };
      clearOnboardingAck('race-user');
    });
  });

  it('stale local flag alone cannot bypass cloud false without session ack', () => {
    setLocallyOnboarded('race-user');
    expect(isLocallyOnboarded('race-user')).toBe(true);
    expect(hasOnboardingAck('race-user')).toBe(false);
    authState.profile = { ...authState.profile, onboarded: false };
    render(<MemoryRouter initialEntries={['/dashboard']}><AppShell /></MemoryRouter>);
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
    render(<MemoryRouter initialEntries={['/dashboard']}><AppShell /></MemoryRouter>);
    expect(screen.queryByText('Dashboard Active')).not.toBeInTheDocument();
  });
});
