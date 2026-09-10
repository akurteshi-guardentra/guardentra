import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import {
  AuthProvider,
  useAuth,
  shouldUseLocalProfileFallback,
  HOSTED_PROFILE_MAX_ATTEMPTS,
  HOSTED_PROFILE_RETRY_BASE_MS,
  HOSTED_PROFILE_LOAD_ERROR,
} from '../lib/AuthContext';
import { __resetOnboardingAcksForTests } from '../lib/onboardingAck';
import { clearLocallyOnboarded } from '../lib/onboardingFlag';

const bootstrapMock = vi.hoisted(() =>
  vi.fn(async (_uid: string, _fields: { email: string | null; displayName: string }) => undefined),
);

vi.mock('../lib/orgBootstrap', () => ({
  bootstrapUserProfile: (uid: string, fields: { email: string | null; displayName: string }) =>
    bootstrapMock(uid, fields),
}));

vi.mock('../lib/firebase-utils', () => ({
  logOut: vi.fn(async () => undefined),
}));

type SnapshotHandler = {
  next: (snap: { exists: () => boolean; data: () => Record<string, unknown> }) => void | Promise<void>;
  error?: (err: { code?: string; message?: string }) => void;
};

const harness = vi.hoisted(() => ({
  authCb: null as null | ((user: unknown) => void),
  snapshot: null as null | SnapshotHandler,
  snapshotCalls: 0,
  user: {
    uid: 'cloud-user-1',
    email: 'admin@example.com',
    displayName: 'Admin',
  },
}));

function Probe() {
  const { user, profile, loading, profileError, retryProfileLoad } = useAuth();
  if (user && profileError && !profile) {
    return (
      <div>
        <div>ProfileLoadError</div>
        <div>{profileError}</div>
        <button type="button" onClick={() => retryProfileLoad()}>
          Retry
        </button>
      </div>
    );
  }
  if (loading || (user && !profile)) return <div>Loading</div>;
  if (!user) return <div>LoggedOut</div>;
  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          profile?.onboarded ? <Navigate to="/dashboard" replace /> : <div>OnboardingPage</div>
        }
      />
      <Route
        path="/dashboard"
        element={
          !profile?.onboarded ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <div>
              DashboardPage org={profile.organizationId} onboarded={String(profile.onboarded)}
            </div>
          )
        }
      />
      <Route
        path="/"
        element={<Navigate to={profile?.onboarded ? '/dashboard' : '/onboarding'} replace />}
      />
    </Routes>
  );
}

function renderApp(initial = '/') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function signIn() {
  await act(async () => {
    harness.authCb?.(harness.user);
  });
}

async function emitCloudProfile(data: Record<string, unknown>) {
  await act(async () => {
    await harness.snapshot?.next({
      exists: () => true,
      data: () => data,
    });
  });
}

async function emitMissingProfile() {
  await act(async () => {
    await harness.snapshot?.next({
      exists: () => false,
      data: () => ({}),
    });
  });
}

async function emitListenerError(code = 'unavailable') {
  await act(async () => {
    harness.snapshot?.error?.({ code, message: code });
  });
}

const cloudOnboarded = {
  email: 'admin@example.com',
  displayName: 'Admin',
  role: 'admin',
  organizationId: 'org_real_staging',
  onboarded: true,
};

const cloudIncomplete = {
  ...cloudOnboarded,
  onboarded: false,
};

function installAuthMocks() {
  harness.authCb = null;
  harness.snapshot = null;
  harness.snapshotCalls = 0;

  vi.mocked(onAuthStateChanged).mockImplementation(((_auth: unknown, cb: (user: unknown) => void) => {
    harness.authCb = cb;
    return vi.fn();
  }) as unknown as typeof onAuthStateChanged);

  vi.mocked(onSnapshot).mockImplementation(((_ref: unknown, next: SnapshotHandler['next'], error?: SnapshotHandler['error']) => {
    harness.snapshotCalls += 1;
    harness.snapshot = { next, error };
    return vi.fn();
  }) as unknown as typeof onSnapshot);
}

describe('shouldUseLocalProfileFallback', () => {
  it('disables local fallback for staging and prod project ids', () => {
    expect(shouldUseLocalProfileFallback('guardentra-staging')).toBe(false);
    expect(shouldUseLocalProfileFallback('guardentra-prod')).toBe(false);
  });

  it('allows local fallback for demo / empty / unknown local projects', () => {
    expect(shouldUseLocalProfileFallback('guardentra-7f582')).toBe(true);
    expect(shouldUseLocalProfileFallback('')).toBe(true);
    expect(shouldUseLocalProfileFallback('demo-guardentra')).toBe(true);
  });
});

describe('AuthContext hosted onboarding bounce', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    __resetOnboardingAcksForTests();
    clearLocallyOnboarded(harness.user.uid);
    bootstrapMock.mockReset();
    localStorage.clear();
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'guardentra-staging');
    installAuthMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'AIzaSyDummyVitestFirebaseKey000');
  });

  it('A: cloud onboarded=true → login lands on dashboard', async () => {
    renderApp('/');
    await signIn();
    await emitCloudProfile(cloudOnboarded);
    await waitFor(() => expect(screen.getByText(/DashboardPage/)).toBeInTheDocument());
    expect(screen.getByText(/org=org_real_staging/)).toBeInTheDocument();
    expect(screen.queryByText('OnboardingPage')).toBeNull();
  });

  it('B: delayed cloud profile must NOT manufacture local_org incomplete profile', async () => {
    renderApp('/');
    await signIn();
    expect(screen.getByText('Loading')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByText('OnboardingPage')).toBeNull();
    expect(localStorage.getItem(`guardentra.localProfile.v1.${harness.user.uid}`)).toBeNull();

    await emitCloudProfile(cloudOnboarded);
    await waitFor(() => expect(screen.getByText(/DashboardPage/)).toBeInTheDocument());
    expect(screen.getByText(/org=org_real_staging/)).toBeInTheDocument();
  });

  it('C: cloud onboarded=false → onboarding', async () => {
    renderApp('/');
    await signIn();
    await emitCloudProfile(cloudIncomplete);
    await waitFor(() => expect(screen.getByText('OnboardingPage')).toBeInTheDocument());
    expect(screen.queryByText(/DashboardPage/)).toBeNull();
  });

  it('D: logout then login with cloud onboarded=true → dashboard (no bounce)', async () => {
    renderApp('/');
    await signIn();
    await emitCloudProfile(cloudOnboarded);
    await waitFor(() => expect(screen.getByText(/DashboardPage/)).toBeInTheDocument());

    await act(async () => {
      harness.authCb?.(null);
    });
    await waitFor(() => expect(screen.getByText('LoggedOut')).toBeInTheDocument());

    await signIn();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByText('OnboardingPage')).toBeNull();
    expect(screen.getByText('Loading')).toBeInTheDocument();

    await emitCloudProfile(cloudOnboarded);
    await waitFor(() => expect(screen.getByText(/DashboardPage/)).toBeInTheDocument());
  });

  it('E: token refresh for same UID must not reset onboarding state', async () => {
    renderApp('/');
    await signIn();
    await emitCloudProfile(cloudOnboarded);
    await waitFor(() => expect(screen.getByText(/DashboardPage/)).toBeInTheDocument());

    await signIn();
    await emitCloudProfile(cloudOnboarded);
    await waitFor(() => expect(screen.getByText(/DashboardPage/)).toBeInTheDocument());
    expect(screen.queryByText('OnboardingPage')).toBeNull();
  });

  it('F: missing first-time user still bootstraps', async () => {
    renderApp('/');
    await signIn();
    await emitMissingProfile();
    await waitFor(() =>
      expect(bootstrapMock).toHaveBeenCalledWith(
        harness.user.uid,
        expect.objectContaining({ email: harness.user.email }),
      ),
    );
    await emitCloudProfile(cloudIncomplete);
    await waitFor(() => expect(screen.getByText('OnboardingPage')).toBeInTheDocument());
  });

  it('G: hosted listener error before profile → retry, no local_org, no onboarding', async () => {
    renderApp('/');
    await signIn();
    expect(harness.snapshotCalls).toBe(1);

    await emitListenerError('unavailable');
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByText('OnboardingPage')).toBeNull();
    expect(localStorage.getItem(`guardentra.localProfile.v1.${harness.user.uid}`)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOSTED_PROFILE_RETRY_BASE_MS);
    });
    expect(harness.snapshotCalls).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('OnboardingPage')).toBeNull();
    expect(localStorage.getItem(`guardentra.localProfile.v1.${harness.user.uid}`)).toBeNull();
  });

  it('H: hosted transient error after onboarded=true keeps cloud profile usable', async () => {
    renderApp('/');
    await signIn();
    await emitCloudProfile(cloudOnboarded);
    await waitFor(() => expect(screen.getByText(/DashboardPage/)).toBeInTheDocument());

    await emitListenerError('unavailable');
    expect(screen.getByText(/DashboardPage/)).toBeInTheDocument();
    expect(screen.queryByText('OnboardingPage')).toBeNull();
    expect(screen.queryByText('ProfileLoadError')).toBeNull();
    expect(localStorage.getItem(`guardentra.localProfile.v1.${harness.user.uid}`)).toBeNull();
  });

  it('I: hosted repeated listener failures → recoverable error, not spinner/onboarding', async () => {
    renderApp('/');
    await signIn();

    for (let i = 0; i < HOSTED_PROFILE_MAX_ATTEMPTS; i++) {
      await emitListenerError('unavailable');
      if (i < HOSTED_PROFILE_MAX_ATTEMPTS - 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(HOSTED_PROFILE_RETRY_BASE_MS * 2 ** i + 10);
        });
      }
    }

    await waitFor(() => expect(screen.getByText('ProfileLoadError')).toBeInTheDocument());
    expect(screen.getByText(HOSTED_PROFILE_LOAD_ERROR)).toBeInTheDocument();
    expect(screen.queryByText('OnboardingPage')).toBeNull();
    expect(screen.queryByText('Loading')).toBeNull();
    expect(localStorage.getItem(`guardentra.localProfile.v1.${harness.user.uid}`)).toBeNull();
  });

  it('J: Retry after error → cloud onboarded=true → Dashboard', async () => {
    renderApp('/');
    await signIn();

    for (let i = 0; i < HOSTED_PROFILE_MAX_ATTEMPTS; i++) {
      await emitListenerError('unavailable');
      if (i < HOSTED_PROFILE_MAX_ATTEMPTS - 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(HOSTED_PROFILE_RETRY_BASE_MS * 2 ** i + 10);
        });
      }
    }

    await waitFor(() => expect(screen.getByText('ProfileLoadError')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Loading')).toBeInTheDocument());
    await emitCloudProfile(cloudOnboarded);
    await waitFor(() => expect(screen.getByText(/DashboardPage/)).toBeInTheDocument());
    expect(screen.queryByText('ProfileLoadError')).toBeNull();
  });
});

describe('AuthContext local/demo fallback still available', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    __resetOnboardingAcksForTests();
    clearLocallyOnboarded(harness.user.uid);
    bootstrapMock.mockReset();
    localStorage.clear();
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'guardentra-7f582');
    installAuthMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'AIzaSyDummyVitestFirebaseKey000');
  });

  it('demo project may use local profile after timeout', async () => {
    renderApp('/');
    await signIn();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await waitFor(() => expect(screen.getByText('OnboardingPage')).toBeInTheDocument());
    expect(localStorage.getItem(`guardentra.localProfile.v1.${harness.user.uid}`)).toBeTruthy();
  });
});
