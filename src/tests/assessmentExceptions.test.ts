import { describe, expect, it } from 'vitest';
import {
  exceptionReasonLabel,
  listAssessmentExceptions,
} from '../lib/vendor/assessmentExceptions';

const questions = [
  { id: 'q_1', category: 'Access Control', question: 'MFA for privileged accounts?', required: true },
  { id: 'q_2', category: 'Access Control', question: 'SSO enforced?', required: true },
  { id: 'q_3', category: 'Data Protection', question: 'Encryption at rest?', required: true },
  { id: 'q_4', category: 'Company Profile', question: 'Company legal name?', required: false },
];

describe('listAssessmentExceptions', () => {
  it('flags unanswered required questions', () => {
    const ex = listAssessmentExceptions({
      questions,
      answers: { q_2: 'Yes', q_3: 'Yes' },
    });
    expect(ex.some((e) => e.id === 'q_1' && e.reason === 'unanswered')).toBe(true);
    expect(ex.some((e) => e.id === 'q_4')).toBe(false);
  });

  it('flags No and Partially as negative exceptions', () => {
    const ex = listAssessmentExceptions({
      questions,
      answers: { q_1: 'No', q_2: 'Partially', q_3: 'Yes' },
    });
    expect(ex.filter((e) => e.reason === 'negative').map((e) => e.id).sort()).toEqual([
      'q_1',
      'q_2',
    ]);
  });

  it('flags missing evidence only when evidence map is provided', () => {
    const withoutMap = listAssessmentExceptions({
      questions: [questions[0]],
      answers: { q_1: 'Yes' },
    });
    expect(withoutMap.some((e) => e.reason === 'missing_evidence')).toBe(false);

    const withEmpty = listAssessmentExceptions({
      questions: [questions[0]],
      answers: { q_1: 'Yes' },
      evidenceByQuestion: { q_1: [] },
    });
    expect(withEmpty.some((e) => e.id === 'q_1' && e.reason === 'missing_evidence')).toBe(true);

    const withFile = listAssessmentExceptions({
      questions: [questions[0]],
      answers: { q_1: 'Yes' },
      evidenceByQuestion: {
        q_1: [{ fileName: 'policy.pdf', storagePath: 'portal/a/p.pdf', scanStatus: 'clean' }],
      },
    });
    expect(withFile.some((e) => e.reason === 'missing_evidence')).toBe(false);

    const pendingOnly = listAssessmentExceptions({
      questions: [questions[0]],
      answers: { q_1: 'Yes' },
      evidenceByQuestion: {
        q_1: [{ fileName: 'policy.pdf', storagePath: 'portal/a/p.pdf', scanStatus: 'pending' }],
      },
    });
    expect(pendingOnly.some((e) => e.id === 'q_1' && e.reason === 'missing_evidence')).toBe(true);

    const selfCertifiedDeniedByMap = listAssessmentExceptions({
      questions: [questions[0]],
      answers: { q_1: 'Yes' },
      evidenceByQuestion: {
        q_1: [{ fileName: 'policy.pdf', storagePath: 'portal/a/p.pdf', scanStatus: 'clean' }],
      },
      evidenceScanByStoragePath: { 'portal/a/p.pdf': 'quarantined' },
    });
    expect(selfCertifiedDeniedByMap.some((e) => e.reason === 'missing_evidence')).toBe(true);
  });

  it('sorts by category then id', () => {
    const ex = listAssessmentExceptions({
      questions,
      answers: { q_1: 'No', q_3: 'No' },
    });
    const cats = ex.map((e) => e.category);
    expect(cats[0]).toBe('Access Control');
    expect(cats[cats.length - 1]).toBe('Data Protection');
  });

  it('labels reasons for UI', () => {
    expect(exceptionReasonLabel('unanswered')).toMatch(/unanswered/i);
    expect(exceptionReasonLabel('negative')).toMatch(/partially/i);
    expect(exceptionReasonLabel('missing_evidence')).toMatch(/evidence/i);
  });
});
