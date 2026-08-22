import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuditReadiness } from '../pages/AuditReadiness';
import { AuthProvider } from '../lib/AuthContext';
import { currentPackDisplayNames } from '../lib/vendor/frameworkPacks';
import * as firestore from 'firebase/firestore';

const NYDFS = 'NYDFS Part 500';

function renderAuditLab() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AuditReadiness />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Audit Lab empty-compliance selection (Issue #26 / C-041)', () => {
  it('cannot select or persist NYDFS Part 500 when the tenant has no compliance rows', async () => {
    const shipped = currentPackDisplayNames();
    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped).not.toContain(NYDFS);

    renderAuditLab();

    expect(await screen.findByText(/Audit Lab/i)).toBeInTheDocument();

    const selector = await screen.findByRole('combobox');
    await waitFor(() => {
      expect(currentPackDisplayNames()).toContain((selector as HTMLSelectElement).value);
    });

    const selected = (selector as HTMLSelectElement).value;
    expect(selected).not.toBe(NYDFS);
    expect(screen.queryByRole('option', { name: NYDFS })).not.toBeInTheDocument();
    expect(screen.getByText(/No Compliance frameworks yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Start Readiness Scan/i }));

    await waitFor(() => {
      expect(firestore.addDoc).toHaveBeenCalled();
    });

    const generateCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([input]) => String(typeof input === 'string' ? input : input?.url || '').includes('/api/ai/generate')
    );
    expect(generateCalls.length).toBeGreaterThan(0);
    const generateBody = JSON.parse(String(generateCalls[generateCalls.length - 1][1]?.body || '{}'));
    expect(generateBody.prompt).not.toMatch(/NYDFS Part 500/);
    expect(shipped.some((name) => generateBody.prompt.includes(name))).toBe(true);

    const addPayload = (firestore.addDoc as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as {
      framework?: string;
    };
    expect(shipped).toContain(addPayload.framework);
    expect(addPayload.framework).not.toBe(NYDFS);
  });
});
