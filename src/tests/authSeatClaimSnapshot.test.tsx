import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, onSnapshot } from 'firebase/firestore';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { claimInviteSeat } from '../lib/orgBootstrap';

type UserStub = { uid: string; email: string; displayName: string };

const gates = vi.hoisted(() => ({
  holdClaim: false,
  holdRead: false,
  releaseClaim: null as null | (() => void),
  releaseRead: null as null | (() => void),
  claimCalls: 0,
}));

vi.mock('../lib/orgBootstrap', () => ({
  bootstrapUserProfile: vi.fn(async () => undefined),
  claimInviteSeat: vi.fn(
    () =>
      new Promise<void>((resolve) => {
        gates.claimCalls += 1;
        if (!gates.holdClaim) {
          resolve();
          return;
        }
        gates.releaseClaim = () => resolve();
      }),
  ),
}));

const harness = vi.hoisted(() => ({
  authCb: null as null | ((user: UserStub | null) => void),
  snapshot: null as null | ((snap: unknown) => void | Promise<void>),
}));

const userA: UserStub = { uid: 'user-a', email: 'a@example.com', displayName: 'A' };
const userB: UserStub = { uid: 'user-b', email: 'b@example.com', displayName: 'B' };

const settled = {
  email: 'a@example.com',
  displayName: 'A',
  role: 'member',
  organizationId: 'org-a',
  onboarded: true,
  seatCountApplied: true,
};

function Probe() {
  const { user, profile } = useAuth();
  if (!user) return <div>LoggedOut profile={profile?.organizationId ?? 'none'}</div>;
  if (!profile) return <div>Loading uid={user.uid}</div>;
  return (
    <div>
      Profile uid={user.uid} org={profile.organizationId} seat={String(profile.seatCountApplied)}
    </div>
  );
}

function unclaimedSnap() {
  return {
    exists: () => true,
    data: () => ({
      email: 'a@example.com',
      displayName: 'A',
      role: 'member',
      organizationId: 'org-a',
      onboarded: true,
      seatCountApplied: false,
    }),
    metadata: { hasPendingWrites: false },
  };
}

function installMocks() {
  vi.mocked(onAuthStateChanged).mockImplementation(((_auth, cb) => {
    harness.authCb = cb as (user: UserStub | null) => void;
    return vi.fn();
  }) as typeof onAuthStateChanged);
  vi.mocked(onSnapshot).mockImplementation(((_ref, ...args: unknown[]) => {
    if (args[0] && typeof args[0] === 'object') args.shift();
    harness.snapshot = args[0] as (snap: unknown) => void | Promise<void>;
    return vi.fn();
  }) as unknown as typeof onSnapshot);
  vi.mocked(getDoc).mockImplementation(
    () =>
      new Promise((resolve) => {
        const snap = { exists: () => true, data: () => settled };
        if (!gates.holdRead) {
          resolve(snap as never);
          return;
        }
        gates.releaseRead = () => resolve(snap as never);
      }) as ReturnType<typeof getDoc>,
  );
}

async function signIn(user: UserStub | null) {
  await act(async () => {
    harness.authCb?.(user);
  });
}

async function flushMicrotasks() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

function startUnclaimed() {
  return Promise.resolve(harness.snapshot?.(unclaimedSnap()));
}

describe('AuthContext seat-claim snapshot lifetime', () => {
  beforeEach(() => {
    gates.holdClaim = false;
    gates.holdRead = false;
    gates.releaseClaim = null;
    gates.releaseRead = null;
    gates.claimCalls = 0;
    harness.authCb = null;
    harness.snapshot = null;
    vi.mocked(claimInviteSeat).mockClear();
    installMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('publishes the settled profile when the same user is still active', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await signIn(userA);
    await act(async () => {
      await startUnclaimed();
    });
    expect(claimInviteSeat).toHaveBeenCalledWith('user-a', 'org-a');
    expect(screen.getByText('Profile uid=user-a org=org-a seat=true')).toBeInTheDocument();
  });

  it('does not apply the profile after sign-out during claimInviteSeat', async () => {
    gates.holdClaim = true;
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await signIn(userA);
    const pending = startUnclaimed();
    await flushMicrotasks();
    expect(gates.claimCalls).toBe(1);
    await signIn(null);
    await act(async () => {
      gates.releaseClaim?.();
      await pending;
    });
    expect(screen.getByText('LoggedOut profile=none')).toBeInTheDocument();
  });

  it('does not apply the profile after sign-out during the follow-up read', async () => {
    gates.holdRead = true;
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await signIn(userA);
    const pending = startUnclaimed();
    await flushMicrotasks();
    expect(gates.releaseRead).toEqual(expect.any(Function));
    await signIn(null);
    await act(async () => {
      gates.releaseRead?.();
      await pending;
    });
    expect(screen.getByText('LoggedOut profile=none')).toBeInTheDocument();
  });

  it('does not apply user A after an account switch during claimInviteSeat', async () => {
    gates.holdClaim = true;
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await signIn(userA);
    const pending = startUnclaimed();
    await flushMicrotasks();
    await signIn(userB);
    await act(async () => {
      gates.releaseClaim?.();
      await pending;
    });
    expect(screen.getByText('Loading uid=user-b')).toBeInTheDocument();
    expect(screen.queryByText(/org=org-a/)).toBeNull();
  });

  it('does not apply user A after an account switch during the follow-up read', async () => {
    gates.holdRead = true;
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await signIn(userA);
    const pending = startUnclaimed();
    await flushMicrotasks();
    await signIn(userB);
    await act(async () => {
      gates.releaseRead?.();
      await pending;
    });
    expect(screen.getByText('Loading uid=user-b')).toBeInTheDocument();
    expect(screen.queryByText(/org=org-a/)).toBeNull();
  });

  it('does not apply the profile after unmount during claimInviteSeat', async () => {
    gates.holdClaim = true;
    const view = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await signIn(userA);
    const pending = startUnclaimed();
    await flushMicrotasks();
    view.unmount();
    await act(async () => {
      gates.releaseClaim?.();
      await pending;
    });
    expect(gates.claimCalls).toBe(1);
    expect(screen.queryByText(/org=org-a/)).toBeNull();
  });

  it('retries a failed seat claim while the same user stays active', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(claimInviteSeat).mockRejectedValueOnce(new Error('unavailable'));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await signIn(userA);
    await act(async () => {
      await startUnclaimed();
    });
    expect(screen.getByText('Loading uid=user-a')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await act(async () => {
      await harness.snapshot?.(unclaimedSnap());
    });
    expect(claimInviteSeat).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Profile uid=user-a org=org-a seat=true')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
