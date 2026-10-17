import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { VerificationBanner } from '../components/VerificationBanner';

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
  return {
    uid,
    email: `${uid}@example.com`,
    emailVerified: false,
    isAnonymous: false,
    displayName: tag,
    tag,
    reload: vi.fn(async () => undefined),
    getIdToken: vi.fn(async () => 'token'),
  };
}

function SessionTree({ seen }: { seen: string[] }) {
  const { user } = useAuth();
  seen.push((user as FakeUser | null)?.tag ?? 'none');
  return <VerificationBanner />;
}

async function signIn(user: FakeUser | null) {
  (auth as { currentUser: unknown }).currentUser = user;
  await act(async () => {
    harness.authCb?.(user);
  });
}

describe('AuthProvider verification session ownership', () => {
  beforeEach(() => {
    harness.authCb = null;
    vi.mocked(sendEmailVerification).mockReset();
    vi.mocked(onAuthStateChanged).mockImplementation(((_auth, cb) => {
      harness.authCb = cb as (user: FakeUser | null) => void;
      return vi.fn();
    }) as typeof onAuthStateChanged);
  });

  afterEach(() => {
    (auth as { currentUser: unknown }).currentUser = { uid: 'test-user', email: 'test@example.com' };
  });

  it('confirms a resend that finishes on the same Auth user', async () => {
    const user = makeUser('a1', 'user-a');
    vi.mocked(sendEmailVerification).mockResolvedValue(undefined);
    const seen: string[] = [];
    render(
      <StrictMode>
        <AuthProvider>
          <SessionTree seen={seen} />
        </AuthProvider>
      </StrictMode>,
    );
    await signIn(user);
    fireEvent.click(screen.getByTestId('resend-verification'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(sendEmailVerification).toHaveBeenCalledTimes(1);
    expect(sendEmailVerification).toHaveBeenCalledWith(user);
    expect(screen.getByRole('status')).toHaveTextContent('Delivery is not confirmed');
    expect(screen.getByTestId('resend-verification')).toBeDisabled();
  });

  it('drops a same-uid replacement and a batched return without releasing the new lock', async () => {
    const userA1 = makeUser('a1', 'user-a');
    const userB = makeUser('b', 'user-b');
    const userA2 = makeUser('a2', 'user-a');
    let releaseSend: () => void = () => {};
    vi.mocked(sendEmailVerification).mockImplementation((() => new Promise<void>((resolve) => {
      releaseSend = () => resolve();
    })) as typeof sendEmailVerification);
    let releaseRefresh: () => void = () => {};
    userA2.reload.mockImplementation(() => new Promise<void>((resolve) => {
      releaseRefresh = () => resolve();
    }));
    const seen: string[] = [];
    render(
      <StrictMode>
        <AuthProvider>
          <SessionTree seen={seen} />
        </AuthProvider>
      </StrictMode>,
    );
    await signIn(userA1);
    fireEvent.click(screen.getByTestId('resend-verification'));
    expect(sendEmailVerification).toHaveBeenCalledTimes(1);
    expect(sendEmailVerification).toHaveBeenCalledWith(userA1);

    const beforeReturn = seen.length;
    await act(async () => {
      (auth as { currentUser: unknown }).currentUser = null;
      harness.authCb?.(null);
      (auth as { currentUser: unknown }).currentUser = userB;
      harness.authCb?.(userB);
      (auth as { currentUser: unknown }).currentUser = userA2;
      harness.authCb?.(userA2);
    });
    const duringReturn = seen.slice(beforeReturn);
    expect(duringReturn.some((tag) => tag === 'b' || tag === 'none')).toBe(false);
    expect(duringReturn).toContain('a2');
    expect(screen.getByRole('status')).toHaveTextContent('Please verify your email address');
    expect(screen.getByRole('status')).not.toHaveTextContent('Delivery is not confirmed');

    fireEvent.click(screen.getByTestId('recheck-verification'));
    expect(userA2.reload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('recheck-verification'));
    expect(userA2.reload).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseSend();
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).not.toHaveTextContent('Delivery is not confirmed');
    expect(screen.getByRole('status')).not.toHaveTextContent('signed-in account changed');
    expect(userA2.reload).toHaveBeenCalledTimes(1);
    expect(userA1.getIdToken).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('recheck-verification'));
    fireEvent.click(screen.getByTestId('resend-verification'));
    expect(userA2.reload).toHaveBeenCalledTimes(1);
    expect(sendEmailVerification).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseRefresh();
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Email is still unverified.');
    expect(userA2.getIdToken).toHaveBeenCalledWith(true);
    expect(userA2.emailVerified).toBe(false);

    fireEvent.click(screen.getByTestId('recheck-verification'));
    expect(userA2.reload).toHaveBeenCalledTimes(2);
  });

  it('clears dismissal and cooldown when the same uid returns as a new session', async () => {
    const userA1 = makeUser('a1', 'user-a');
    const userA2 = makeUser('a2', 'user-a');
    vi.mocked(sendEmailVerification).mockResolvedValue(undefined);
    const seen: string[] = [];
    render(
      <StrictMode>
        <AuthProvider>
          <SessionTree seen={seen} />
        </AuthProvider>
      </StrictMode>,
    );
    await signIn(userA1);
    fireEvent.click(screen.getByTestId('resend-verification'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('resend-verification')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Delivery is not confirmed');

    await signIn(userA2);
    expect(screen.getByTestId('resend-verification')).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Please verify your email address');
    expect(screen.getByRole('status')).not.toHaveTextContent('Delivery is not confirmed');

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByTestId('verification-banner')).toBeNull();
    const userA3 = makeUser('a3', 'user-a');
    await signIn(userA3);
    expect(screen.getByTestId('verification-banner')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Please verify your email address');
  });
});
