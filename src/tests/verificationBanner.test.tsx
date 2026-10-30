import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VerificationBanner, VERIFICATION_RESEND_COOLDOWN_MS, VERIFICATION_RESEND_ERROR_COOLDOWN_MS } from '../components/VerificationBanner';
import { Layout } from '../components/Layout';

const harness = vi.hoisted(() => ({
  auth: {
    user: null as null | {
      uid: string;
      email: string | null;
      emailVerified: boolean;
      isAnonymous: boolean;
      displayName?: string;
      photoURL?: string | null;
    },
    refreshVerification: vi.fn(async (): Promise<string> => 'unverified'),
    verificationRefreshError: null as string | null,
    profile: { displayName: 'Analyst', role: 'admin', organizationId: 'org-1' },
  },
  emit: () => {},
}));

const sendMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => harness.auth,
}));

vi.mock('../lib/firebase-utils', () => ({
  resendVerificationEmail: () => sendMock(),
  logOut: vi.fn(async () => undefined),
}));

function user(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    uid,
    email: `${uid}@example.com`,
    emailVerified: false,
    isAnonymous: false,
    displayName: uid,
    photoURL: null,
    ...overrides,
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    harness.emit = () => setTick((value) => value + 1);
    return () => {
      harness.emit = () => {};
    };
  }, []);
  return <>{children}</>;
}

function renderBanner() {
  return render(
    <Shell>
      <VerificationBanner />
    </Shell>,
  );
}

function showUser(view: ReturnType<typeof render>, next: ReturnType<typeof user>) {
  harness.auth.user = next;
  view.rerender(
    <Shell>
      <VerificationBanner />
    </Shell>,
  );
}

describe('VerificationBanner', () => {
  beforeEach(() => {
    harness.auth.user = user('user-a');
    harness.auth.verificationRefreshError = null;
    harness.auth.refreshVerification.mockReset();
    harness.auth.refreshVerification.mockResolvedValue('unverified');
    sendMock.mockReset();
    sendMock.mockResolvedValue({ status: 'sent', uid: 'user-a' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides the banner when there is no user, an anonymous user, or a verified user', () => {
    harness.auth.user = null;
    const { rerender } = renderBanner();
    expect(screen.queryByTestId('verification-banner')).toBeNull();

    harness.auth.user = user('anon', { isAnonymous: true });
    rerender(<Shell><VerificationBanner /></Shell>);
    expect(screen.queryByTestId('verification-banner')).toBeNull();

    harness.auth.user = user('verified', { emailVerified: true });
    rerender(<Shell><VerificationBanner /></Shell>);
    expect(screen.queryByTestId('verification-banner')).toBeNull();
  });

  it('requests one verification email and keeps retry available after the cooldown', async () => {
    vi.useFakeTimers();
    renderBanner();
    expect(screen.getByRole('status')).toHaveTextContent('Please verify your email address');
    fireEvent.click(screen.getByTestId('resend-verification'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Delivery is not confirmed');
    expect(screen.getByTestId('resend-verification')).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERIFICATION_RESEND_COOLDOWN_MS);
    });
    expect(screen.getByTestId('resend-verification')).toBeEnabled();
    fireEvent.click(screen.getByTestId('resend-verification'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a second click while the first request is in flight', async () => {
    let resolveSend: (value: { status: 'sent'; uid: string }) => void = () => {};
    sendMock.mockImplementation(() => new Promise((resolve) => {
      resolveSend = resolve;
    }));
    renderBanner();
    const button = screen.getByTestId('resend-verification');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(sendMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSend({ status: 'sent', uid: 'user-a' });
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('shows a sanitized network or rate-limit error and allows a later retry', async () => {
    vi.useFakeTimers();
    sendMock.mockRejectedValueOnce({
      code: 'auth/network-request-failed',
      message: 'secret-token for a@example.com',
    });
    renderBanner();
    fireEvent.click(screen.getByTestId('resend-verification'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Network problem');
    expect(screen.queryByText(/secret-token/)).toBeNull();
    expect(screen.getByTestId('resend-verification')).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERIFICATION_RESEND_ERROR_COOLDOWN_MS);
    });
    sendMock.mockRejectedValueOnce({
      code: 'auth/too-many-requests',
      message: 'raw sdk dump',
    });
    fireEvent.click(screen.getByTestId('resend-verification'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts');
    expect(screen.queryByText(/raw sdk dump/)).toBeNull();
  });

  it('reports still unverified and hides after a real verification refresh', async () => {
    renderBanner();
    fireEvent.click(screen.getByTestId('recheck-verification'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Email is still unverified.');

    harness.auth.refreshVerification.mockImplementation(async () => {
      if (harness.auth.user) harness.auth.user.emailVerified = true;
      harness.emit();
      return 'verified';
    });
    fireEvent.click(screen.getByTestId('recheck-verification'));
    await act(async () => {
      await Promise.resolve();
      harness.emit();
    });
    expect(screen.queryByTestId('verification-banner')).toBeNull();
  });

  it('does not let a stale account A request overwrite account B or a later A session', async () => {
    let resolveA: (value: { status: 'sent'; uid: string }) => void = () => {};
    sendMock.mockImplementation(() => new Promise((resolve) => {
      resolveA = resolve;
    }));
    const view = renderBanner();
    fireEvent.click(screen.getByTestId('resend-verification'));
    expect(sendMock).toHaveBeenCalledTimes(1);

    showUser(view, user('user-b'));
    expect(screen.getByRole('status')).toHaveTextContent('Please verify your email address');

    let resolveB: (value: { status: 'sent'; uid: string }) => void = () => {};
    sendMock.mockImplementation(() => new Promise((resolve) => {
      resolveB = resolve;
    }));
    fireEvent.click(screen.getByTestId('resend-verification'));
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('resend-verification')).toBeDisabled();

    await act(async () => {
      resolveA({ status: 'sent', uid: 'user-a' });
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).not.toHaveTextContent('Delivery is not confirmed');
    expect(screen.getByTestId('resend-verification')).toBeDisabled();

    await act(async () => {
      resolveB({ status: 'sent', uid: 'user-b' });
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Delivery is not confirmed');

    let resolveLaterA: (value: { status: 'sent'; uid: string }) => void = () => {};
    sendMock.mockImplementation(() => new Promise((resolve) => {
      resolveLaterA = resolve;
    }));
    showUser(view, user('user-a'));
    fireEvent.click(screen.getByTestId('resend-verification'));
    showUser(view, user('user-b'));
    showUser(view, user('user-a'));
    await act(async () => {
      resolveLaterA({ status: 'sent', uid: 'user-a' });
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Please verify your email address');
    expect(screen.getByRole('status')).not.toHaveTextContent('Delivery is not confirmed');
  });

  it('does not apply a resolved request after unmount', async () => {
    let resolveSend: (value: { status: 'sent'; uid: string }) => void = () => {};
    sendMock.mockImplementation(() => new Promise((resolve) => {
      resolveSend = resolve;
    }));
    const view = renderBanner();
    fireEvent.click(screen.getByTestId('resend-verification'));
    view.unmount();
    await act(async () => {
      resolveSend({ status: 'sent', uid: 'user-a' });
      await Promise.resolve();
    });
    expect(screen.queryByTestId('verification-banner')).toBeNull();
  });

  it('does not start a second refresh while one is already running', async () => {
    let resolveRefresh: (value: 'unverified') => void = () => {};
    harness.auth.refreshVerification.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));
    renderBanner();
    fireEvent.click(screen.getByTestId('recheck-verification'));
    fireEvent.click(screen.getByTestId('recheck-verification'));
    fireEvent.click(screen.getByTestId('resend-verification'));
    expect(harness.auth.refreshVerification).toHaveBeenCalledTimes(1);
    expect(sendMock).not.toHaveBeenCalled();
    await act(async () => {
      resolveRefresh('unverified');
      await Promise.resolve();
    });
  });

  it('refreshes when the document becomes visible again, once at a time', async () => {
    let resolveRefresh: (value: 'unverified') => void = () => {};
    harness.auth.refreshVerification.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));
    renderBanner();
    const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(harness.auth.refreshVerification).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(harness.auth.refreshVerification).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRefresh('unverified');
      await Promise.resolve();
    });
    if (descriptor) Object.defineProperty(document, 'visibilityState', descriptor);
  });

  it('resets a dismissal when the signed-in account changes', async () => {
    const view = renderBanner();
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByTestId('verification-banner')).toBeNull();
    showUser(view, user('user-b'));
    expect(screen.getByTestId('verification-banner')).toBeInTheDocument();
  });

  it('renders inside Layout for an unverified user', () => {
    render(
      <MemoryRouter>
        <Shell>
          <Layout>
            <div>Page body</div>
          </Layout>
        </Shell>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('verification-banner')).toBeInTheDocument();
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
