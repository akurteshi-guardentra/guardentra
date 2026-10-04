import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as firestore from 'firebase/firestore';
import { Onboarding } from '../pages/Onboarding';
import { __resetOnboardingAcksForTests, acknowledgeOnboardingComplete, hasOnboardingAck } from '../lib/onboardingAck';
import { clearLocallyOnboarded, isLocallyOnboarded, setLocallyOnboarded } from '../lib/onboardingFlag';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const authState = vi.hoisted(() => ({
  user: { uid: 'user-1', email: 'admin@example.com', displayName: 'Admin' } as any,
  profile: {
    email: 'admin@example.com',
    displayName: 'Admin',
    role: 'admin',
    organizationId: 'org-1',
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
}));

vi.mock('../lib/firebase-utils', () => ({ logOut: vi.fn() }));

describe('#67 progressive onboarding migration bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    __resetOnboardingAcksForTests();
    clearLocallyOnboarded('user-1');
    authState.user = { uid: 'user-1', email: 'admin@example.com', displayName: 'Admin' };
    authState.profile = {
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
      organizationId: 'org-1',
      onboarded: false,
    };
    authState.loading = false;
    authState.acknowledgeDurableOnboarding = () => {
      acknowledgeOnboardingComplete('user-1');
      setLocallyOnboarded('user-1');
      authState.profile = { ...authState.profile, onboarded: true };
    };
    vi.mocked(firestore.updateDoc).mockResolvedValue(undefined as any);
  });

  it('automatically persists completion and navigates without the old wizard', async () => {
    render(<MemoryRouter><Onboarding /></MemoryRouter>);
    await waitFor(() => expect(firestore.updateDoc).toHaveBeenCalled());
    const writes = vi.mocked(firestore.updateDoc).mock.calls;
    expect(writes).toHaveLength(1);
    expect(String((writes[0][0] as any)?.path || '')).toContain('users/user-1');
    expect(writes[0][1]).toMatchObject({ onboarded: true });
    expect(writes[0][1]).not.toHaveProperty('organizationId');
    await waitFor(() => {
      expect(hasOnboardingAck('user-1')).toBe(true);
      expect(isLocallyOnboarded('user-1')).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
    expect(screen.queryByText(/assessment packs should vendors complete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sample data/i)).not.toBeInTheDocument();
  });

  it('invited member only completes their own profile', async () => {
    authState.profile = { ...authState.profile, role: 'member', organizationId: 'shared-org', onboarded: false };
    render(<MemoryRouter><Onboarding /></MemoryRouter>);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }));
    const writes = vi.mocked(firestore.updateDoc).mock.calls;
    expect(writes).toHaveLength(1);
    expect(String((writes[0][0] as any)?.path || '')).toContain('users/user-1');
    expect(String((writes[0][0] as any)?.path || '')).not.toContain('organizations/');
  });

  it('fails closed after one automatic attempt; profile refresh cannot retry until explicit Retry', async () => {
    vi.mocked(firestore.updateDoc)
      .mockRejectedValueOnce(new Error('permission-denied'))
      .mockResolvedValue(undefined as any);

    const { rerender } = render(<MemoryRouter><Onboarding /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
    expect(isLocallyOnboarded('user-1')).toBe(false);
    expect(navigateMock).not.toHaveBeenCalledWith('/dashboard', { replace: true });

    authState.profile = { ...authState.profile };
    rerender(<MemoryRouter><Onboarding /></MemoryRouter>);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalledWith('/dashboard', { replace: true });

    fireEvent.click(screen.getByRole('button', { name: /retry secure setup/i }));
    await waitFor(() => expect(firestore.updateDoc).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it('existing completed profile goes directly to dashboard with no write', async () => {
    authState.profile = { ...authState.profile, onboarded: true };
    render(<MemoryRouter><Onboarding /></MemoryRouter>);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }));
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });
});
