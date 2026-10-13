import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../AppAuthenticated';

const authState = vi.hoisted(() => ({
  user: { uid: 'u-recovery', email: 'a@example.com' } as any,
  profile: {
    email: 'a@example.com',
    displayName: 'Ada',
    role: 'admin',
    organizationId: '',
    onboarded: false,
  } as any,
  loading: false,
  profileError: null as string | null,
  retryProfileLoad: vi.fn(),
}));

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    profile: authState.profile,
    loading: authState.loading,
    profileError: authState.profileError,
    retryProfileLoad: () => authState.retryProfileLoad(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../lib/firebase-utils', () => ({
  logOut: vi.fn(async () => undefined),
}));

function renderGate(path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <div>Dashboard Secret</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute bootstrap recovery (#67)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { uid: 'u-recovery', email: 'a@example.com' };
    authState.profile = {
      email: 'a@example.com',
      displayName: 'Ada',
      role: 'admin',
      organizationId: '',
      onboarded: false,
    };
    authState.loading = false;
    authState.profileError = null;
    authState.retryProfileLoad = vi.fn();
  });

  it('shows recoverable panel instead of spinner/Dashboard when organizationId is missing', async () => {
    renderGate('/dashboard');
    await waitFor(() => {
      expect(screen.getByTestId('bootstrap-recovery-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('bootstrap-recovery-retry')).toBeInTheDocument();
    expect(screen.getByTestId('bootstrap-recovery-sign-out')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Secret')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });

  it('retry invokes retryProfileLoad without granting tenant access', async () => {
    renderGate('/dashboard');
    fireEvent.click(screen.getByTestId('bootstrap-recovery-retry'));
    expect(authState.retryProfileLoad).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Dashboard Secret')).not.toBeInTheDocument();
  });

  it('after retry binds organizationId, Dashboard children render', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <div>Dashboard Secret</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('bootstrap-recovery-panel')).toBeInTheDocument();

    authState.profile = { ...authState.profile, organizationId: 'org-bound' };
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <div>Dashboard Secret</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Secret')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('bootstrap-recovery-panel')).not.toBeInTheDocument();
  });
});
