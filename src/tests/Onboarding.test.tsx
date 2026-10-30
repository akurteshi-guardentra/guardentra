import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Onboarding } from '../pages/Onboarding';
import { Login } from '../pages/Login';

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
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  resetPassword: vi.fn(),
}));

describe('Issue #67 progressive onboarding routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    authState.user = { uid: 'user-1', email: 'admin@example.com', displayName: 'Admin' };
    authState.profile = {
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
      organizationId: 'org-1',
      onboarded: false,
    };
    authState.loading = false;
  });

  it('legacy /onboarding redirects bootstrapped users to dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<div>Dashboard OK</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard OK')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Load sample demo data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 1 of 3/i)).not.toBeInTheDocument();
  });

  it('login with bootstrapped profile (onboarded=false) lands on dashboard', async () => {
    authState.profile = { ...authState.profile, onboarded: false, organizationId: 'org-1' };
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard OK</div>} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard OK')).toBeInTheDocument();
    });
    expect(screen.queryByText('Onboarding Page')).not.toBeInTheDocument();
  });

  it('login with existing tenant membership (onboarded=true) lands on dashboard', async () => {
    authState.profile = { ...authState.profile, onboarded: true, organizationId: 'org-existing' };
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard OK</div>} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard OK')).toBeInTheDocument();
    });
  });

  it('invited member with organizationId is not blocked by optional setup', async () => {
    authState.profile = {
      email: 'member@example.com',
      displayName: 'Member',
      role: 'member',
      organizationId: 'shared-org',
      onboarded: false,
    };
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard OK</div>} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard OK')).toBeInTheDocument();
    });
    expect(screen.queryByText('Onboarding Page')).not.toBeInTheDocument();
  });

  it('production onboarding surface has no sample-demo checkbox', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<div>Dashboard OK</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard OK')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/sample/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Load sample demo data/i)).not.toBeInTheDocument();
  });
});
