import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthProvider, useAuth, VERIFICATION_REFRESH_ERROR } from '../lib/AuthContext';

type FakeUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  displayName: string;
  tag: string;
  reload: ReturnType<typeof vi.fn>;
  getIdToken: ReturnType<typeof vi.fn>;
};

const harness = vi.hoisted(() => ({
  authCb: null as null | ((user: FakeUser | null) => void),
}));

function makeUser(tag: string, uid = tag): FakeUser {
  const user: FakeUser = {
    uid,
    email: `${uid}@example.com`,
    emailVerified: false,
    isAnonymous: false,
    displayName: tag,
    tag,
    reload: vi.fn(async () => undefined),
    getIdToken: vi.fn(async () => 'token'),
  };
  return user;
}

function Probe() {
  const { user, profile, refreshVerification, verificationRefreshError, verificationRevision } = useAuth();
  const typed = user as FakeUser | null;
  return (
    <div>
      <div data-testid="tag">{typed?.tag || 'none'}</div>
      <div data-testid="verified">{String(Boolean(user?.emailVerified))}</div>
      <div data-testid="reload">{typeof user?.reload}</div>
      <div data-testid="error">{verificationRefreshError || ''}</div>
      <div data-testid="revision">{verificationRevision}</div>
      <div data-testid="org">{profile?.organizationId || ''}</div>
      <button
        type="button"
        onClick={() => {
          void refreshVerification().then((result) => {
            probe.result = result;
          });
        }}
      >
        Refresh
      </button>
    </div>
  );
}

const probe = { result: '' as string, refresh: (async () => 'no-user') as () => Promise<string> };

function RefreshProbe() {
  const { refreshVerification } = useAuth();
  probe.refresh = refreshVerification as () => Promise<string>;
  return <Probe />;
}

async function signIn(user: FakeUser | null) {
  (auth as { currentUser: unknown }).currentUser = user;
  await act(async () => {
    harness.authCb?.(user);
  });
}

describe('AuthContext verification refresh', () => {
  beforeEach(() => {
    probe.result = '';
    harness.authCb = null;
    vi.mocked(onAuthStateChanged).mockImplementation(((_auth, cb) => {
      harness.authCb = cb as (user: FakeUser | null) => void;
      return vi.fn();
    }) as typeof onAuthStateChanged);
  });

  afterEach(() => {
    (auth as { currentUser: unknown }).currentUser = { uid: 'test-user', email: 'test@example.com' };
  });

  it('reloads the same User and reports verified without replacing the instance', async () => {
    const user = makeUser('a1', 'user-a');
    user.reload.mockImplementation(async () => {
      user.emailVerified = true;
    });
    render(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );
    await signIn(user);
    await waitFor(() => expect(screen.getByTestId('org')).toHaveTextContent('test-org'));
    const revision = screen.getByTestId('revision').textContent;

    await act(async () => {
      probe.result = await probe.refresh();
    });

    expect(probe.result).toBe('verified');
    expect(user.reload).toHaveBeenCalledTimes(1);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('tag')).toHaveTextContent('a1');
    expect(screen.getByTestId('verified')).toHaveTextContent('true');
    expect(screen.getByTestId('reload')).toHaveTextContent('function');
    expect(screen.getByTestId('revision').textContent).not.toBe(revision);
    expect(screen.getByTestId('error')).toHaveTextContent('');
  });

  it('keeps an unverified user unverified when reload does not verify them', async () => {
    const user = makeUser('a1', 'user-a');
    render(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );
    await signIn(user);
    await act(async () => {
      probe.result = await probe.refresh();
    });
    expect(probe.result).toBe('unverified');
    expect(screen.getByTestId('verified')).toHaveTextContent('false');
    expect(screen.getByTestId('tag')).toHaveTextContent('a1');
  });

  it('does not reload a missing or anonymous user', async () => {
    const anonymous = makeUser('anon', 'anon');
    anonymous.isAnonymous = true;
    render(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );
    await signIn(anonymous);
    await act(async () => {
      probe.result = await probe.refresh();
    });
    expect(probe.result).toBe('anonymous');
    expect(anonymous.reload).not.toHaveBeenCalled();

    await signIn(null);
    await act(async () => {
      probe.result = await probe.refresh();
    });
    expect(probe.result).toBe('no-user');
  });

  it('keeps a failed refresh recoverable and then accepts a later reload', async () => {
    const user = makeUser('a1', 'user-a');
    user.reload.mockRejectedValueOnce(new Error('offline'));
    render(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );
    await signIn(user);
    await act(async () => {
      probe.result = await probe.refresh();
    });
    expect(probe.result).toBe('unavailable');
    expect(screen.getByTestId('error')).toHaveTextContent(VERIFICATION_REFRESH_ERROR);
    expect(screen.getByTestId('verified')).toHaveTextContent('false');
    expect(user.getIdToken).not.toHaveBeenCalled();

    user.reload.mockImplementation(async () => {
      user.emailVerified = true;
    });
    await act(async () => {
      probe.result = await probe.refresh();
    });
    expect(probe.result).toBe('verified');
    expect(screen.getByTestId('error')).toHaveTextContent('');
    expect(screen.getByTestId('tag')).toHaveTextContent('a1');
    expect(screen.getByTestId('verified')).toHaveTextContent('true');
  });

  it('ignores a refresh that finishes after sign-out', async () => {
    const user = makeUser('a1', 'user-a');
    let release: () => void = () => {};
    user.reload.mockImplementation(() => new Promise<void>((resolve) => {
      release = () => {
        user.emailVerified = true;
        resolve();
      };
    }));
    render(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );
    await signIn(user);
    const pending = probe.refresh();
    await waitFor(() => expect(user.reload).toHaveBeenCalled());
    await signIn(null);
    await act(async () => {
      release();
      probe.result = await pending;
    });
    expect(probe.result).toBe('stale');
    expect(screen.getByTestId('tag')).toHaveTextContent('none');
    expect(user.getIdToken).not.toHaveBeenCalled();
  });

  it('ignores account A after A switches to B and back to a new A session', async () => {
    const userA1 = makeUser('a1', 'user-a');
    const userB = makeUser('b', 'user-b');
    const userA2 = makeUser('a2', 'user-a');
    let release: () => void = () => {};
    userA1.reload.mockImplementation(() => new Promise<void>((resolve) => {
      release = () => {
        userA1.emailVerified = true;
        resolve();
      };
    }));
    render(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );
    await signIn(userA1);
    const pending = probe.refresh();
    await waitFor(() => expect(userA1.reload).toHaveBeenCalled());
    await signIn(userB);
    await signIn(userA2);
    await act(async () => {
      release();
      probe.result = await pending;
    });
    expect(probe.result).toBe('stale');
    expect(screen.getByTestId('tag')).toHaveTextContent('a2');
    expect(screen.getByTestId('verified')).toHaveTextContent('false');
    expect(userA2.emailVerified).toBe(false);
    expect(screen.getByTestId('reload')).toHaveTextContent('function');
    expect(userA1.getIdToken).not.toHaveBeenCalled();
    expect(userA2.reload).not.toHaveBeenCalled();
  });

  it('does not update state after the provider unmounts', async () => {
    const user = makeUser('a1', 'user-a');
    let release: () => void = () => {};
    user.reload.mockImplementation(() => new Promise<void>((resolve) => {
      release = () => resolve();
    }));
    const view = render(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );
    await signIn(user);
    const pending = probe.refresh();
    await waitFor(() => expect(user.reload).toHaveBeenCalled());
    view.unmount();
    await act(async () => {
      release();
      probe.result = await pending;
    });
    expect(probe.result).toBe('stale');
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
});
