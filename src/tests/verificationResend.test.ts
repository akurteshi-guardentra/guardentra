import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import {
  classifyVerificationRecipient,
  resendVerificationEmail,
  type VerificationRecipient,
} from '../lib/firebase-utils';

const eligible = {
  uid: 'user-a',
  email: 'a@example.com',
  emailVerified: false,
  isAnonymous: false,
};

function box(user: VerificationRecipient | null) {
  const state = { user };
  return {
    state,
    getUser: () => state.user,
    send: vi.fn(async (current: VerificationRecipient) => {
      expect(current).toBe(state.user);
    }),
  };
}

describe('classifyVerificationRecipient', () => {
  it('rejects a missing user', () => {
    expect(classifyVerificationRecipient(null)).toBe('no-user');
    expect(classifyVerificationRecipient(undefined)).toBe('no-user');
  });

  it('rejects anonymous users and users without an email', () => {
    expect(classifyVerificationRecipient({ uid: 'anon', isAnonymous: true, email: 'a@example.com' })).toBe('anonymous');
    expect(classifyVerificationRecipient({ uid: 'none', email: '' })).toBe('anonymous');
    expect(classifyVerificationRecipient({ uid: 'none', email: null })).toBe('anonymous');
  });

  it('rejects an already verified user', () => {
    expect(classifyVerificationRecipient({ ...eligible, emailVerified: true })).toBe('already-verified');
  });

  it('accepts an unverified email user', () => {
    expect(classifyVerificationRecipient(eligible)).toBe('eligible');
  });
});

describe('resendVerificationEmail', () => {
  afterEach(() => {
    vi.mocked(sendEmailVerification).mockReset();
    (auth as { currentUser: unknown }).currentUser = { uid: 'test-user', email: 'test@example.com' };
  });

  it('does not send when no user is signed in', async () => {
    const send = vi.fn();
    await expect(resendVerificationEmail({ getUser: () => null, send })).resolves.toEqual({ status: 'no-user' });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send for an anonymous or no-email user', async () => {
    const anonymous = box({ uid: 'anon', isAnonymous: true, email: 'a@example.com', emailVerified: false });
    await expect(resendVerificationEmail(anonymous)).resolves.toEqual({ status: 'anonymous' });
    const missingEmail = box({ uid: 'none', email: null, emailVerified: false, isAnonymous: false });
    await expect(resendVerificationEmail(missingEmail)).resolves.toEqual({ status: 'anonymous' });
    expect(anonymous.send).not.toHaveBeenCalled();
    expect(missingEmail.send).not.toHaveBeenCalled();
  });

  it('does not send when the user is already verified', async () => {
    const verified = box({ ...eligible, emailVerified: true });
    await expect(resendVerificationEmail(verified)).resolves.toEqual({
      status: 'already-verified',
      uid: 'user-a',
    });
    expect(verified.send).not.toHaveBeenCalled();
  });

  it('returns sent only for the same user after the request', async () => {
    const current = box(eligible);
    await expect(resendVerificationEmail(current)).resolves.toEqual({ status: 'sent', uid: 'user-a' });
    expect(current.send).toHaveBeenCalledTimes(1);
  });

  it('does not report success when the session changes while the request is in flight', async () => {
    const current = box(eligible);
    current.send.mockImplementation(async () => {
      current.state.user = { ...eligible, uid: 'user-b' };
    });
    await expect(resendVerificationEmail(current)).resolves.toEqual({
      status: 'session-changed',
      uid: 'user-a',
    });
    expect(current.send).toHaveBeenCalledTimes(1);
  });

  it('rethrows network and rate-limit failures without reporting success', async () => {
    const network = box(eligible);
    network.send.mockRejectedValue({ code: 'auth/network-request-failed', message: 'secret-token' });
    await expect(resendVerificationEmail(network)).rejects.toMatchObject({ code: 'auth/network-request-failed' });

    const limited = box(eligible);
    limited.send.mockRejectedValue({ code: 'auth/too-many-requests', message: 'secret-token' });
    await expect(resendVerificationEmail(limited)).rejects.toMatchObject({ code: 'auth/too-many-requests' });
  });

  it('uses the live Auth user and sendEmailVerification when no override is passed', async () => {
    const user = { ...eligible };
    (auth as { currentUser: unknown }).currentUser = user;
    vi.mocked(sendEmailVerification).mockResolvedValue(undefined);
    await expect(resendVerificationEmail()).resolves.toEqual({ status: 'sent', uid: 'user-a' });
    expect(sendEmailVerification).toHaveBeenCalledWith(user);
  });
});
