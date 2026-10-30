import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../pages/Dashboard';
import { MemoryRouter } from 'react-router-dom';
import * as firestore from 'firebase/firestore';

const authState = vi.hoisted(() => ({
  user: { uid: 'u1', email: 'a@example.com', displayName: 'Ada' } as any,
  profile: {
    email: 'a@example.com',
    displayName: 'Ada Admin',
    role: 'admin',
    organizationId: 'org-dash',
    onboarded: false,
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

function emptySnap(size = 0) {
  return { size, empty: size === 0, docs: [] as any[] };
}

describe('Dashboard progressive setup (#67)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.loading = false;
    authState.profile = {
      email: 'a@example.com',
      displayName: 'Ada Admin',
      role: 'admin',
      organizationId: 'org-dash',
      onboarded: false,
    };
    vi.mocked(firestore.getDocs).mockResolvedValue(emptySnap() as any);
    vi.mocked(firestore.getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ name: "Ada's Organization", autoCreated: true }),
    } as any);
  });

  it('shows progressive checklist and Add first vendor CTA without blocking wizard', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('setup-checklist')).toBeInTheDocument();
    });
    expect(screen.getByTestId('add-first-vendor-cta')).toBeInTheDocument();
    expect(screen.getByText(/Your GuardEntra workspace is ready/i)).toBeInTheDocument();
    expect(screen.queryByText(/Load sample demo data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Operator Action Center/i)).not.toBeInTheDocument();
  });

  it('vendor count advances checklist — primary CTA gone when vendors exist', async () => {
    vi.mocked(firestore.getDocs).mockImplementation(async (q: any) => {
      const path = String(q?.path || q?.type || '');
      // vitest firebase mock may not expose path; use call order via limit rows
      return emptySnap() as any;
    });
    // Force vendorCount via sequential getDocs: vendors, assessments, audit, invites
    let call = 0;
    vi.mocked(firestore.getDocs).mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return { size: 2, empty: false, docs: [{ id: 'v1' }, { id: 'v2' }] } as any;
      }
      return emptySnap() as any;
    });
    vi.mocked(firestore.getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: 'Acme',
        industry: 'SaaS',
        frameworkPackDefaults: { iso27001: 'iso27001_v1' },
        seatCount: 2,
      }),
    } as any);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('add-first-vendor-cta')).not.toBeInTheDocument();
  });

  it('incomplete optional setup still renders dashboard (not redirected)', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /New Assessment/i })).toBeInTheDocument();
  });
});
