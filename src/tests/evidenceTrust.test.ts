import { describe, expect, it } from 'vitest';
import {
  approvalBlockedByUntrustedEvidence,
  classifyStorageMetadata,
  effectiveEvidenceState,
  evidenceStateLabel,
  filterTrustedEvidence,
  hasTrustedEvidence,
  isPortalEvidencePath,
  isTrustedEvidence,
  mergeTrustMapEntry,
  optionBRecordedState,
  trustedEvidenceFileNames,
  type EvidenceTrustRecord,
} from '../lib/vendor/evidenceTrust';

const pdf = {
  fileName: 'policy.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1200,
  storagePath: 'portal/asm1/a-policy.pdf',
};

describe('classifyStorageMetadata Option B', () => {
  it('never returns clean from MIME or size', () => {
    expect(
      classifyStorageMetadata({ contentType: 'application/pdf', sizeBytes: 1000 })
    ).toBe('validated');
    expect(optionBRecordedState('validated')).toBe('scan_pending');
    expect(classifyStorageMetadata({ contentType: 'application/octet-stream', sizeBytes: 1000 })).toBe(
      'quarantined'
    );
    expect(classifyStorageMetadata({ contentType: 'application/pdf', sizeBytes: 0 })).toBe('scan_failed');
  });
});

describe('fail-closed trust', () => {
  const untrusted: Array<Parameters<typeof effectiveEvidenceState>[0]> = [
    { ...pdf },
    { ...pdf, scanStatus: 'clean' },
    { fileName: 'legacy.pdf' },
    null,
    'bad',
  ];

  it('treats uploaded, pending, validated, scan_pending, quarantined, scan_failed, missing, unknown, malformed as untrusted', () => {
    expect(isTrustedEvidence({ ...pdf })).toBe(false);
    expect(effectiveEvidenceState({ ...pdf })).toBe('uploaded');
    expect(
      isTrustedEvidence(
        { ...pdf },
        { [pdf.storagePath.replace(/\//g, '__')]: { state: 'validation_pending', storagePath: pdf.storagePath, updatedAt: 't' } }
      )
    ).toBe(false);
    expect(
      isTrustedEvidence(
        { ...pdf },
        { [pdf.storagePath.replace(/\//g, '__')]: { state: 'validated', storagePath: pdf.storagePath, updatedAt: 't' } }
      )
    ).toBe(false);
    expect(
      isTrustedEvidence(
        { ...pdf },
        { [pdf.storagePath.replace(/\//g, '__')]: { state: 'scan_pending', storagePath: pdf.storagePath, updatedAt: 't' } }
      )
    ).toBe(false);
    expect(
      isTrustedEvidence(
        { ...pdf },
        { [pdf.storagePath.replace(/\//g, '__')]: { state: 'quarantined', storagePath: pdf.storagePath, updatedAt: 't' } }
      )
    ).toBe(false);
    expect(
      isTrustedEvidence(
        { ...pdf },
        { [pdf.storagePath.replace(/\//g, '__')]: { state: 'scan_failed', storagePath: pdf.storagePath, updatedAt: 't' } }
      )
    ).toBe(false);
    expect(effectiveEvidenceState(null)).toBe('missing');
    expect(effectiveEvidenceState({ fileName: 'x' })).toBe('unknown');
    expect(effectiveEvidenceState('nope')).toBe('malformed');
    for (const item of untrusted) {
      expect(isTrustedEvidence(item)).toBe(false);
    }
  });

  it('ignores client scanStatus even when claiming clean', () => {
    expect(isTrustedEvidence({ ...pdf, scanStatus: 'clean' })).toBe(false);
    expect(trustedEvidenceFileNames([{ ...pdf, scanStatus: 'clean' }])).toEqual([]);
  });

  it('trusts only authoritative clean in the backend map', () => {
    const map = {
      [pdf.storagePath.replace(/\//g, '__')]: {
        state: 'clean' as const,
        storagePath: pdf.storagePath,
        updatedAt: 't',
      },
    };
    expect(isTrustedEvidence({ ...pdf, scanStatus: 'pending' }, map)).toBe(true);
    expect(filterTrustedEvidence([{ ...pdf }], map)).toHaveLength(1);
  });

  it('hasTrustedEvidence is true when the map is omitted (legacy helper)', () => {
    expect(hasTrustedEvidence('q1')).toBe(true);
    expect(hasTrustedEvidence('q1', { q1: [{ ...pdf }] })).toBe(false);
  });
});

describe('path binding', () => {
  it('accepts only portal/{assessmentId}/{file}', () => {
    expect(isPortalEvidencePath('asm1', 'portal/asm1/a.pdf')).toBe(true);
    expect(isPortalEvidencePath('asm1', 'portal/asm2/a.pdf')).toBe(false);
    expect(isPortalEvidencePath('asm1', 'portal/asm1/../b.pdf')).toBe(false);
    expect(isPortalEvidencePath('asm1', 'orgs/o/vendors/v/evidence/a.pdf')).toBe(false);
  });
});

describe('concurrency merge', () => {
  it('keeps both files and does not let a stale record replace a newer one', () => {
    const a: EvidenceTrustRecord = {
      state: 'scan_pending',
      storagePath: 'portal/asm1/a.pdf',
      updatedAt: '2026-08-15T12:00:00.000Z',
    };
    const b: EvidenceTrustRecord = {
      state: 'quarantined',
      storagePath: 'portal/asm1/b.pdf',
      updatedAt: '2026-08-15T12:00:01.000Z',
    };
    let map = mergeTrustMapEntry({}, a.storagePath, a);
    map = mergeTrustMapEntry(map, b.storagePath, b);
    expect(Object.keys(map)).toHaveLength(2);

    const stale: EvidenceTrustRecord = {
      state: 'uploaded',
      storagePath: a.storagePath,
      updatedAt: '2026-08-15T11:00:00.000Z',
    };
    const next = mergeTrustMapEntry(map, a.storagePath, stale);
    expect(next[a.storagePath.replace(/\//g, '__')]).toMatchObject({ state: 'scan_pending' });
  });
});

describe('approval gate', () => {
  it('blocks approved when required evidence is untrusted', () => {
    expect(approvalBlockedByUntrustedEvidence([{ reason: 'missing_evidence' }])).toBe(true);
    expect(approvalBlockedByUntrustedEvidence([{ reason: 'negative' }])).toBe(false);
  });

  it('does not emit a malware-safety claim in labels', () => {
    expect(evidenceStateLabel('scan_pending')).not.toMatch(/safe|protected|malware-free/i);
    expect(evidenceStateLabel('validated')).not.toMatch(/scanned clean/i);
  });
});
