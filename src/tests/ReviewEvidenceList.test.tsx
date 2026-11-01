import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReviewEvidenceList } from '../components/assessments/ReviewEvidenceList';
import { encodeTrustMapKey, type EvidenceTrustMap } from '../lib/vendor/evidenceTrust';

const clean = 'portal/a1/q1/clean.pdf';
const bad = 'portal/a1/q1/eicar.pdf';
const pending = 'portal/a1/q1/new.pdf';
const map: EvidenceTrustMap = {
  [encodeTrustMapKey(clean)]: { state: 'clean', storagePath: clean, updatedAt: 'x' },
  [encodeTrustMapKey(bad)]: { state: 'quarantined', storagePath: bad, updatedAt: 'x' },
};
const items = [
  { fileName: 'soc2.pdf', storagePath: clean },
  { fileName: 'eicar.pdf', storagePath: bad },
  { fileName: 'new.pdf', storagePath: pending },
];

describe('ReviewEvidenceList (reviewer evidence view)', () => {
  it('shows each file with its backend trust state', () => {
    render(<ReviewEvidenceList assessmentId="a1" items={items} trustMap={map} allowDownload />);
    expect(screen.getByText('soc2.pdf')).toBeTruthy();
    expect(screen.getByText('Authoritative clean')).toBeTruthy();
    expect(screen.getByText('Quarantined')).toBeTruthy();
    expect(screen.getByText('Uploaded')).toBeTruthy();
  });
  it('offers Open only for the clean file', () => {
    render(<ReviewEvidenceList assessmentId="a1" items={items} trustMap={map} allowDownload />);
    expect(screen.getAllByRole('button', { name: /open/i })).toHaveLength(1);
  });
  it('offers no download for local assessments, and renders nothing without files', () => {
    const { container } = render(
      <ReviewEvidenceList assessmentId="a1" items={items} trustMap={map} allowDownload={false} />
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
    const empty = render(<ReviewEvidenceList assessmentId="a1" items={[]} trustMap={map} allowDownload />);
    expect(empty.container.innerHTML).toBe('');
  });
});
