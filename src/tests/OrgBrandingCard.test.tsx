import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as firestore from 'firebase/firestore';
import { OrgBrandingCard } from '../components/OrgBrandingCard';

const authState = vi.hoisted(() => ({
  profile: {
    organizationId: 'org-synthetic',
    role: 'admin',
    displayName: 'Synthetic Admin',
  } as { organizationId?: string; role?: string; displayName?: string },
}));

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: authState.profile,
    loading: false,
  }),
}));

function orgSnap(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

describe('OrgBrandingCard load recovery', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };

  beforeEach(() => {
    unhandled.length = 0;
    process.on('unhandledRejection', onUnhandled);
    vi.clearAllMocks();
    authState.profile = {
      organizationId: 'org-synthetic',
      role: 'admin',
      displayName: 'Synthetic Admin',
    };
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
  });

  it('shows a successful organization load and does not write', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValue(
      orgSnap({ name: 'Synthetic Co', industry: 'SaaS', logoUrl: '' }) as never,
    );

    render(<OrgBrandingCard />);

    expect(await screen.findByDisplayValue('Synthetic Co')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('SaaS');
    expect(screen.getByRole('button', { name: /Save organization profile/i })).toBeEnabled();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
    expect(unhandled).toEqual([]);
  });

  it('ends a rejected read with a recoverable error and no save', async () => {
    vi.mocked(firestore.getDoc).mockRejectedValue(new Error('synthetic-org-read-denied'));

    render(<OrgBrandingCard />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load organization profile/i);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save organization profile/i })).not.toBeInTheDocument();
    expect(firestore.getDoc).toHaveBeenCalledTimes(1);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(unhandled).toEqual([]);
  });

  it('retries once when asked and then shows the returned organization', async () => {
    vi.mocked(firestore.getDoc)
      .mockRejectedValueOnce(new Error('synthetic-org-read-denied'))
      .mockResolvedValue(orgSnap({ name: 'Recovered Co', industry: 'Insurance', logoUrl: '' }) as never);

    render(<OrgBrandingCard />);

    const retry = await screen.findByRole('button', { name: /^Retry$/i });
    expect(firestore.getDoc).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(firestore.getDoc).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);

    expect(await screen.findByDisplayValue('Recovered Co')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('Insurance');
    expect(firestore.getDoc).toHaveBeenCalledTimes(2);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(unhandled).toEqual([]);
  });

  it('keeps a non-admin profile read-only after success, failure, and retry', async () => {
    authState.profile = {
      organizationId: 'org-synthetic',
      role: 'member',
      displayName: 'Synthetic Member',
    };
    vi.mocked(firestore.getDoc).mockResolvedValue(
      orgSnap({ name: 'Synthetic Co', industry: 'SaaS', logoUrl: '' }) as never,
    );

    const view = render(<OrgBrandingCard />);
    const input = await screen.findByDisplayValue('Synthetic Co');
    expect(input).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
    const save = screen.getByRole('button', { name: /Save organization profile/i });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(firestore.updateDoc).not.toHaveBeenCalled();

    vi.mocked(firestore.getDoc).mockRejectedValueOnce(new Error('synthetic-org-read-denied'));
    authState.profile = { ...authState.profile, organizationId: 'org-synthetic-next' };
    view.rerender(<OrgBrandingCard />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save organization profile/i })).not.toBeInTheDocument();
    expect(firestore.updateDoc).not.toHaveBeenCalled();

    vi.mocked(firestore.getDoc).mockResolvedValue(
      orgSnap({ name: 'Member Org', industry: 'Education', logoUrl: '' }) as never,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Retry$/i }));

    const recovered = await screen.findByDisplayValue('Member Org');
    expect(recovered).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
    const recoveredSave = screen.getByRole('button', { name: /Save organization profile/i });
    expect(recoveredSave).toBeDisabled();
    fireEvent.click(recoveredSave);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('does not read or write when no organization is bound', async () => {
    authState.profile = { role: 'admin', displayName: 'Synthetic Admin' };

    render(<OrgBrandingCard />);

    expect(await screen.findByText(/No organization is bound to this profile/i)).toBeInTheDocument();
    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Save organization profile/i })).not.toBeInTheDocument();
    expect(unhandled).toEqual([]);
  });

  it('ignores a late result after the organization changes or the card unmounts', async () => {
    let releaseOld: (value: unknown) => void = () => undefined;
    const oldRead = new Promise((resolve) => {
      releaseOld = resolve;
    });
    vi.mocked(firestore.getDoc).mockImplementationOnce(() => oldRead as never);

    const view = render(<OrgBrandingCard />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    vi.mocked(firestore.getDoc).mockResolvedValue(
      orgSnap({ name: 'Current Org', industry: 'SaaS', logoUrl: '' }) as never,
    );
    authState.profile = {
      organizationId: 'org-current',
      role: 'admin',
      displayName: 'Synthetic Admin',
    };
    view.rerender(<OrgBrandingCard />);

    expect(await screen.findByDisplayValue('Current Org')).toBeInTheDocument();
    releaseOld(orgSnap({ name: 'Stale Org', industry: 'Other', logoUrl: '' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByDisplayValue('Current Org')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Stale Org')).not.toBeInTheDocument();

    let releaseLate: (value: unknown) => void = () => undefined;
    const lateRead = new Promise((resolve) => {
      releaseLate = resolve;
    });
    vi.mocked(firestore.getDoc).mockImplementationOnce(() => lateRead as never);
    authState.profile = {
      organizationId: 'org-leaving',
      role: 'admin',
      displayName: 'Synthetic Admin',
    };
    view.rerender(<OrgBrandingCard />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    view.unmount();
    releaseLate(orgSnap({ name: 'After Unmount', industry: 'SaaS', logoUrl: '' }));
    await Promise.resolve();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
    expect(unhandled).toEqual([]);
  });
});
