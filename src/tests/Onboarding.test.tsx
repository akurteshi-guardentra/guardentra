import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as firestore from 'firebase/firestore';
import { Onboarding } from '../pages/Onboarding';
import { Login } from '../pages/Login';
import {
  clearLocallyOnboarded,
  isLocallyOnboarded,
  setLocallyOnboarded,
} from '../lib/onboardingFlag';
import { frameworkComplianceDocId } from '../lib/seeding';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
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
}));

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    profile: authState.profile,
    loading: authState.loading,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../lib/firebase-utils', () => ({
  logOut: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('../lib/seeding', async () => {
  const actual = await vi.importActual<typeof import('../lib/seeding')>('../lib/seeding');
  return {
    ...actual,
    seedProfessionalData: vi.fn(() =>
      Promise.resolve({
        skipped: false,
        batchCommits: 1,
        writeCount: 24,
        durationMs: 12,
        sampleSeedVersion: 'v1',
      })
    ),
  };
});

async function walkToFinishStep() {
  fireEvent.change(screen.getByPlaceholderText(/e.g. Acme Cybersec/i), {
    target: { value: 'Guardentra Test Org' },
  });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SaaS' } });
  fireEvent.click(screen.getByText(/Continue to Frameworks/i));
  await waitFor(() => {
    expect(screen.getByText(/Which assessment packs should vendors complete/i)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText(/ISO 27001:2022/i));
  fireEvent.click(screen.getByText(/Review and finish/i));
  await waitFor(() => {
    expect(screen.getByText(/You're all set/i)).toBeInTheDocument();
  });
}

describe('issue #41 onboarding durability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
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
    vi.mocked(firestore.updateDoc).mockResolvedValue(undefined as any);
    vi.mocked(firestore.setDoc).mockResolvedValue(undefined as any);
  });

  it('successful finish persists onboarded=true then sets local cache and navigates', async () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    await walkToFinishStep();
    fireEvent.click(screen.getByText(/Finish setup/i));

    await waitFor(() => {
      expect(firestore.updateDoc).toHaveBeenCalled();
    });

    const userUpdates = vi
      .mocked(firestore.updateDoc)
      .mock.calls.filter((c) => String((c[0] as any)?.path || '').includes('users/'));
    expect(userUpdates.length).toBeGreaterThan(0);
    expect(userUpdates[0][1]).toMatchObject({ onboarded: true });
    // organizationId must not be rewritten (rules: orgId immutable)
    expect(userUpdates[0][1]).not.toHaveProperty('organizationId');

    await waitFor(() => {
      expect(isLocallyOnboarded('user-1')).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('failed durable user-profile update does NOT navigate and does NOT set local cache', async () => {
    vi.mocked(firestore.updateDoc).mockImplementation(async (ref: any) => {
      if (String(ref?.path || '').includes('users/')) {
        throw new Error('permission-denied');
      }
    });

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    await walkToFinishStep();
    fireEvent.click(screen.getByText(/Finish setup/i));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(isLocallyOnboarded('user-1')).toBe(false);
    expect(navigateMock).not.toHaveBeenCalledWith('/dashboard');
  });

  it('local flag alone cannot manufacture durable success when cloud profile is incomplete', async () => {
    setLocallyOnboarded('user-1');
    authState.profile = { ...authState.profile, onboarded: false };

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    // Still on onboarding (cloud incomplete clears/ignores local)
    await waitFor(() => {
      expect(screen.getByText(/set up your workspace/i)).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalledWith('/dashboard');
    expect(isLocallyOnboarded('user-1')).toBe(false);
  });

  it('completed cloud profile redirects to dashboard (login path)', async () => {
    authState.profile = { ...authState.profile, onboarded: true };
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard OK</div>} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard OK')).toBeInTheDocument();
    });
    expect(screen.queryByText('Onboarding Page')).not.toBeInTheDocument();
  });

  it('incomplete cloud profile routes login to onboarding', async () => {
    authState.profile = { ...authState.profile, onboarded: false };
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard OK</div>} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
    });
  });

  it('completed cloud profile on Onboarding redirects to dashboard (refresh / logout-login)', async () => {
    authState.profile = { ...authState.profile, onboarded: true };
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('invited member does not overwrite shared org setup', async () => {
    authState.profile = {
      ...authState.profile,
      role: 'member',
      organizationId: 'shared-org',
      onboarded: false,
    };

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    await walkToFinishStep();
    fireEvent.click(screen.getByText(/Finish setup/i));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/dashboard');
    });

    const orgUpdates = vi
      .mocked(firestore.updateDoc)
      .mock.calls.filter((c) => String((c[0] as any)?.path || '').includes('organizations/'));
    expect(orgUpdates).toHaveLength(0);
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('framework initialization uses deterministic compliance ids (retry-safe)', async () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    await walkToFinishStep();
    fireEvent.click(screen.getByText(/Finish setup/i));

    await waitFor(() => {
      expect(firestore.setDoc).toHaveBeenCalled();
    });

    const expectedId = frameworkComplianceDocId('org-1', 'iso27001');
    const paths = vi.mocked(firestore.setDoc).mock.calls.map((c) => (c[0] as any)?.path || (c[0] as any)?.id);
    expect(paths.some((p) => String(p).includes(expectedId))).toBe(true);

    // Retry finish after failure on user update should still use same deterministic id
    vi.mocked(firestore.setDoc).mockClear();
    vi.mocked(firestore.updateDoc).mockResolvedValue(undefined as any);
    // Stay on step 3 and finish again
    fireEvent.click(screen.getByText(/Finish setup/i));
    await waitFor(() => {
      expect(firestore.setDoc).toHaveBeenCalled();
    });
    const paths2 = vi.mocked(firestore.setDoc).mock.calls.map((c) => (c[0] as any)?.path || (c[0] as any)?.id);
    expect(paths2.some((p) => String(p).includes(expectedId))).toBe(true);
  });

  it('Finish button disables and shows progress while finishing', async () => {
    let resolveUserUpdate: () => void = () => {};
    vi.mocked(firestore.updateDoc).mockImplementation((ref: any) => {
      if (String(ref?.path || '').includes('users/')) {
        return new Promise((resolve) => {
          resolveUserUpdate = () => resolve(undefined as any);
        });
      }
      return Promise.resolve(undefined as any);
    });

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    await walkToFinishStep();
    fireEvent.click(screen.getByText(/Finish setup/i));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Saving|Finishing|Creating|Initializing/i })).toBeDisabled();
    });
    resolveUserUpdate();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/dashboard');
    });
  });
});
