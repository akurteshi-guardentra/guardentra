/**
 * #124 full-acceptance minor findings (staging e7357f5, 2026-11-01):
 * 1. portal file status lost on reload, 2. packet raw ISO dates + next-review
 * mismatch, 3. quarantined evidence labelled "Missing evidence", 4. decision API
 * returned 400 before 401.
 */
import { describe, expect, it } from 'vitest';
import {
  encodeTrustMapKey,
  hasPendingEvidenceScan,
  portalEvidenceDisplayState,
  type EvidenceTrustMap,
} from '../lib/vendor/evidenceTrust';
import {
  evidenceGapStatus,
  exceptionReasonsLabel,
  groupExceptionsByQuestion,
  listAssessmentExceptions,
} from '../lib/vendor/assessmentExceptions';
import {
  buildVendorDecisionProjection,
  decisionNextReviewAt,
} from '../lib/vendor/assessmentLifecycle';
import {
  buildDecisionPacketHtml,
  formatPacketDay,
  formatPacketTimestamp,
} from '../lib/vendor/reportExport';
import { handleOrgDecision } from '../../server/lib/evidenceAccess';

const clean = 'portal/asm1/q_1/clean.pdf';
const bad = 'portal/asm1/q_2/eicar.pdf';
const map: EvidenceTrustMap = {
  [encodeTrustMapKey(clean)]: { state: 'clean', storagePath: clean, updatedAt: '2026-11-01T15:40:00Z' },
  [encodeTrustMapKey(bad)]: { state: 'quarantined', storagePath: bad, updatedAt: '2026-11-01T15:41:00Z' },
};

describe('finding 1: portal evidence status after reload', () => {
  it('reads the backend trust map, not the default "uploaded"', () => {
    expect(portalEvidenceDisplayState(clean, map)).toBe('clean');
    expect(portalEvidenceDisplayState(bad, map)).toBe('quarantined');
  });
  it('falls back to the in-session hint, then uploaded', () => {
    expect(portalEvidenceDisplayState('portal/asm1/q_3/new.pdf', map, 'scan_pending')).toBe('scan_pending');
    expect(portalEvidenceDisplayState('portal/asm1/q_3/new.pdf', {})).toBe('uploaded');
  });
  it('a stale in-session hint does not override a later scanner verdict', () => {
    expect(portalEvidenceDisplayState(bad, map, 'scan_pending')).toBe('quarantined');
  });
});

describe('follow-up: live scan verdict listener gate', () => {
  it('listens while a file has no terminal verdict, stops once all do', () => {
    const pending = 'portal/asm1/q_3/new.pdf';
    const ev = { q_1: [{ storagePath: clean }], q_3: [{ storagePath: pending }] };
    expect(hasPendingEvidenceScan(ev, map, { [pending]: 'scan_pending' })).toBe(true);
    const done: EvidenceTrustMap = {
      ...map,
      [encodeTrustMapKey(pending)]: { state: 'clean', storagePath: pending, updatedAt: 'x' },
    };
    expect(hasPendingEvidenceScan(ev, done, { [pending]: 'scan_pending' })).toBe(false);
    expect(hasPendingEvidenceScan({ q_2: [{ storagePath: bad }] }, map)).toBe(false);
    expect(hasPendingEvidenceScan({}, map)).toBe(false);
  });
});

describe('finding 3: quarantined evidence is not "Missing evidence"', () => {
  const questions = [
    { id: 'q_1', question: 'Q1', required: true },
    { id: 'q_2', question: 'Q2', required: true },
    { id: 'q_3', question: 'Q3', required: true },
    { id: 'q_4', question: 'Q4', required: true },
  ];
  const evidenceByQuestion = {
    q_1: [{ fileName: 'clean.pdf', storagePath: clean }],
    q_2: [{ fileName: 'eicar.pdf', storagePath: bad }],
    q_3: [],
    q_4: [{ fileName: 'new.pdf', storagePath: 'portal/asm1/q_4/new.pdf' }],
  };
  const ex = listAssessmentExceptions({
    questions,
    answers: { q_1: 'Yes', q_2: 'Yes', q_3: 'Yes', q_4: 'Yes' },
    evidenceByQuestion,
    evidenceTrustByStoragePath: map,
  });
  const rows = groupExceptionsByQuestion(ex);
  const label = (id: string) => {
    const r = rows.find((x) => x.id === id);
    return r ? exceptionReasonsLabel(r.reasons, r.evidenceStatus) : null;
  };

  it('keeps the missing_evidence reason so the approval guard is unchanged', () => {
    expect(ex.filter((e) => e.reason === 'missing_evidence').map((e) => e.id)).toEqual(['q_2', 'q_3', 'q_4']);
  });
  it('labels each gap by what actually happened', () => {
    expect(label('q_1')).toBeNull();
    expect(label('q_2')).toBe('Evidence quarantined (malware detected)');
    expect(label('q_3')).toBe('Missing evidence');
    expect(label('q_4')).toBe('Evidence not yet verified clean');
  });
  it('quarantine wins over other untrusted files on the same question', () => {
    expect(
      evidenceGapStatus([{ storagePath: 'portal/x/new.pdf' }, { storagePath: bad }], map)
    ).toBe('quarantined');
    expect(evidenceGapStatus(undefined, map)).toBe('none');
  });
});

describe('finding 2: decision packet dates', () => {
  const decidedAt = '2026-11-01T15:52:10.123Z';
  it('packet next review equals what the vendor record stores', () => {
    for (const outcome of ['remediate', 'conditional', 'approved', 'rejected'] as const) {
      const vendor = buildVendorDecisionProjection({
        outcome,
        residualRiskLevel: 'High',
        decidedAt,
        remediationDueAt: '2026-12-15',
      });
      expect(decisionNextReviewAt({ outcome, decidedAt, remediationDueAt: '2026-12-15' })).toBe(
        vendor.nextReviewAt
      );
    }
    expect(
      decisionNextReviewAt({ outcome: 'remediate', decidedAt, remediationDueAt: '2026-12-15' }).slice(0, 10)
    ).toBe('2026-12-15');
  });
  it('prints readable dates, not raw ISO timestamps', () => {
    const html = buildDecisionPacketHtml({
      vendorName: 'V',
      assessmentId: 'asm1',
      frameworksLabel: 'SOC 2',
      outcome: 'remediate',
      decidedBy: 'Reviewer',
      decidedAt,
      remediationOwner: 'Owner',
      remediationDueAt: '2026-12-15T23:59:59.999Z',
      residualRiskLevel: 'High',
      nextReviewAt: decisionNextReviewAt({ outcome: 'remediate', decidedAt, remediationDueAt: '2026-12-15' }),
      exceptions: [],
    });
    expect(html).toContain('Due: Dec 15, 2026');
    expect(html).toContain('Next review: Dec 15, 2026');
    expect(html).toContain('at Nov 1, 2026, 15:52 UTC');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
  it('formatters are timezone-stable and tolerate bad input', () => {
    expect(formatPacketDay('2026-12-15T23:59:59.999Z')).toBe('Dec 15, 2026');
    expect(formatPacketDay(undefined)).toBe('—');
    expect(formatPacketDay('not a date')).toBe('not a date');
    expect(formatPacketTimestamp('2026-11-01T00:05:00Z')).toBe('Nov 1, 2026, 00:05 UTC');
  });
});

describe('finding 4: decision API authenticates before validating the body', () => {
  function res() {
    return {
      statusCode: 200,
      body: null as unknown,
      status(n: number) {
        this.statusCode = n;
        return this;
      },
      json(b: unknown) {
        this.body = b;
        return this;
      },
    };
  }
  const deps = {
    verifyIdToken: async () => {
      throw new Error('should not be called without a token');
    },
  } as any;

  it('no token + incomplete body -> 401, not 400', async () => {
    const r = res();
    await handleOrgDecision({ headers: {}, body: { assessmentId: 'asm1' } } as any, r as any, deps);
    expect(r.statusCode).toBe(401);
  });
  it('no token + unknown outcome -> 401', async () => {
    const r = res();
    await handleOrgDecision(
      { headers: {}, body: { outcome: 'ship-it' } } as any,
      r as any,
      deps
    );
    expect(r.statusCode).toBe(401);
  });
});
