import { describe, expect, it } from 'vitest';
import {
  attestationsComplete,
  effectiveAnswersForProgress,
  type AnswerProposal,
} from '../lib/vendor/portalProposals';

describe('portal proposals', () => {
  it('excludes unconfirmed AI proposals from progress answers', () => {
    const proposals: Record<string, AnswerProposal> = {
      q1: {
        questionId: 'q1',
        proposedAnswer: 'Yes',
        status: 'proposed',
        proposedAt: '2026-01-01T00:00:00.000Z',
      },
      q2: {
        questionId: 'q2',
        proposedAnswer: 'No',
        status: 'accepted',
        proposedAt: '2026-01-01T00:00:00.000Z',
        confirmedAt: '2026-01-01T00:01:00.000Z',
      },
    };
    const effective = effectiveAnswersForProgress(
      { q1: 'Yes', q2: 'No', q3: 'Partially' },
      proposals
    );
    expect(effective.q1).toBeUndefined();
    expect(effective.q2).toBe('No');
    expect(effective.q3).toBe('Partially');
  });

  it('requires both attestations', () => {
    expect(attestationsComplete({ accuracy: true, authority: false })).toBe(false);
    expect(attestationsComplete({ accuracy: true, authority: true })).toBe(true);
  });
});
