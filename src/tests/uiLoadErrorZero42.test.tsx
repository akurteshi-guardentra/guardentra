import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import * as firestore from 'firebase/firestore';
import { Dashboard } from '../pages/Dashboard';
import { VendorsDirectory } from '../pages/VendorsDirectory';

const authState = vi.hoisted(() => ({
  user: { uid: 'u1', email: 'a@example.com', displayName: 'Ada' } as any,
  profile: {
    email: 'a@example.com',
    displayName: 'Ada Admin',
    role: 'admin',
    organizationId: 'org-dash',
    onboarded: true,
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

vi.mock('../lib/vendor/useOrgVendors', () => ({
  useOrgVendors: () => ({
    vendors: [],
    mode: 'cloud',
    loading: false,
    refreshLocal: () => undefined,
  }),
}));

function emptySnap(size = 0) {
  return { size, empty: size === 0, docs: [] as any[] };
}

describe('Dashboard load/error/zero states (#42)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.loading = false;
    authState.profile = {
      email: 'a@example.com',
      displayName: 'Ada Admin',
      role: 'admin',
      organizationId: 'org-dash',
      onboarded: true,
    };
    vi.mocked(firestore.getDocs).mockResolvedValue(emptySnap() as any);
    vi.mocked(firestore.getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ name: "Ada's Organization", autoCreated: true }),
    } as any);
  });

  it('shows recoverable error and unavailable counts when Promise.all rejects', async () => {
    vi.mocked(firestore.getDocs).mockRejectedValue(new Error('permission-denied'));
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-stats-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('dashboard-vendor-count')).toHaveTextContent('—');
    expect(screen.getByTestId('dashboard-pending-count')).toHaveTextContent('—');
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it('renders readiness 0% instead of an em dash when score is zero', async () => {
    let call = 0;
    vi.mocked(firestore.getDocs).mockImplementation(async () => {
      call += 1;
      if (call === 3) {
        return {
          size: 1,
          empty: false,
          docs: [{ id: 'a1', data: () => ({ readinessScore: 0 }) }],
        } as any;
      }
      return emptySnap() as any;
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-readiness')).toHaveTextContent('0%');
    });
  });

  it('retry reloads stats after a failure', async () => {
    vi.mocked(firestore.getDocs)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(emptySnap() as any);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-stats-error')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-stats-error')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('dashboard-vendor-count')).toHaveTextContent('0');
  });

  it('hides the previous organization count while the next organization is loading', async () => {
    let releaseNext: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseNext = resolve;
    });
    let phase: 'first' | 'second' = 'first';
    vi.mocked(firestore.getDocs).mockImplementation(async () => {
      if (phase === 'second') await gate;
      const size = phase === 'first' ? 4 : 1;
      return {
        size,
        empty: false,
        docs: Array.from({ length: size }, () => ({ data: () => ({ status: 'Sent' }) })),
      } as any;
    });

    const view = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-vendor-count')).toHaveTextContent('4');
    });

    phase = 'second';
    authState.profile = { ...authState.profile, organizationId: 'org-other' };
    view.rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-vendor-count')).toHaveTextContent('—');
    });
    expect(screen.getByTestId('dashboard-vendor-count')).not.toHaveTextContent('4');
    releaseNext();
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-vendor-count')).toHaveTextContent('1');
    });
  });
});

describe('VendorsDirectory plan meter (#42)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.loading = false;
    vi.mocked(firestore.onSnapshot).mockImplementation((_q: any, _ok?: any, err?: any) => {
      // Keep vendors path quiet; plan meter uses getDoc.
      if (typeof err === 'function') {
        // no-op
      }
      return () => undefined;
    });
  });

  it('shows unavailable state when organization getDoc rejects', async () => {
    vi.mocked(firestore.getDoc).mockRejectedValue(new Error('unavailable'));
    render(
      <MemoryRouter>
        <VendorsDirectory />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('plan-meter-unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText(/vendors on your plan/i)).not.toBeInTheDocument();
  });
});

describe('Assessments reminder copy (#42)', () => {
  it('reminder failure text stays provider-neutral (source contract)', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, '../pages/Assessments.tsx'), 'utf8');
    expect(src).not.toMatch(/Trigger Email extension/);
    expect(src).toMatch(/Queue acceptance is not inbox delivery/);
  });
});
