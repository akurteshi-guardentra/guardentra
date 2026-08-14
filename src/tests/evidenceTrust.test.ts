import { describe, expect, it } from 'vitest';
import {
  classifyEvidenceScan,
  effectiveScanStatus,
  filterTrustedEvidence,
  hasTrustedEvidence,
  isTrustedEvidence,
  trustedEvidenceFileNames,
} from '../lib/vendor/evidenceTrust';

const pdf = {
  fileName: 'policy.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1200,
  storagePath: 'portal/asm1/a-policy.pdf',
  scanStatus: 'pending' as const,
};

describe('classifyEvidenceScan', () => {
  it('marks allowed PDF as clean', () => {
    expect(
      classifyEvidenceScan({
        contentType: 'application/pdf',
        sizeBytes: 1000,
        fileName: 'a.pdf',
      })
    ).toBe('clean');
  });

  it('quarantines octet-stream', () => {
    expect(
      classifyEvidenceScan({
        contentType: 'application/octet-stream',
        sizeBytes: 1000,
        fileName: 'a.bin',
      })
    ).toBe('quarantined');
  });

  it('fails empty or oversized files', () => {
    expect(classifyEvidenceScan({ contentType: 'application/pdf', sizeBytes: 0 })).toBe('failed');
    expect(
      classifyEvidenceScan({ contentType: 'application/pdf', sizeBytes: 26 * 1024 * 1024 })
    ).toBe('failed');
  });
});

describe('isTrustedEvidence fail-closed', () => {
  it('does not trust pending, failed, quarantined, or missing status', () => {
    expect(isTrustedEvidence({ ...pdf, scanStatus: 'pending' })).toBe(false);
    expect(isTrustedEvidence({ ...pdf, scanStatus: 'failed' })).toBe(false);
    expect(isTrustedEvidence({ ...pdf, scanStatus: 'quarantined' })).toBe(false);
    expect(isTrustedEvidence({ fileName: 'legacy.pdf' })).toBe(false);
  });

  it('trusts clean when no scan map is present (local / after classify)', () => {
    expect(isTrustedEvidence({ ...pdf, scanStatus: 'clean' })).toBe(true);
  });

  it('scan map is authoritative and ignores a self-certified clean file', () => {
    const map = { [pdf.storagePath]: 'pending' as const };
    expect(isTrustedEvidence({ ...pdf, scanStatus: 'clean' }, map)).toBe(false);
    expect(isTrustedEvidence({ ...pdf, scanStatus: 'pending' }, { [pdf.storagePath]: 'clean' })).toBe(
      true
    );
  });

  it('missing map entry with a map present is untrusted', () => {
    expect(isTrustedEvidence({ ...pdf, scanStatus: 'clean' }, { other: 'clean' })).toBe(false);
  });
});

describe('review helpers', () => {
  it('filters trusted names for AI / review', () => {
    const list = [
      { ...pdf, scanStatus: 'pending' },
      { ...pdf, storagePath: 'portal/asm1/b.pdf', fileName: 'ok.pdf', scanStatus: 'clean' },
    ];
    expect(trustedEvidenceFileNames(list)).toEqual(['ok.pdf']);
    expect(filterTrustedEvidence(list)).toHaveLength(1);
  });

  it('hasTrustedEvidence is true when map omitted (legacy exception helper)', () => {
    expect(hasTrustedEvidence('q1')).toBe(true);
  });

  it('empty or untrusted lists are not trusted evidence', () => {
    expect(hasTrustedEvidence('q1', { q1: [] })).toBe(false);
    expect(hasTrustedEvidence('q1', { q1: [{ ...pdf, scanStatus: 'pending' }] })).toBe(false);
    expect(hasTrustedEvidence('q1', { q1: [{ ...pdf, scanStatus: 'clean' }] })).toBe(true);
  });
});

describe('effectiveScanStatus', () => {
  it('prefers the scan map', () => {
    expect(effectiveScanStatus({ ...pdf, scanStatus: 'clean' }, { [pdf.storagePath]: 'failed' })).toBe(
      'failed'
    );
  });
});
