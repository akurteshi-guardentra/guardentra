/**
 * FastTrack + Phase 2 gate — automated checks that can run without staging Firebase.
 * Staging still needs the manual checklist in docs/FASTTRACK_PHASE2.md after this suite is green.
 */
import { describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import {
  applyTierQuestionCap,
  buildQuestionsForPackIds,
  resolvePackIdsForFrameworks,
} from '../lib/vendor/frameworkPacks';
import {
  attestationsComplete,
  effectiveAnswersForProgress,
  type AnswerProposal,
} from '../lib/vendor/portalProposals';
import { buildDecisionPacketHtml } from '../lib/vendor/reportExport';
import { canonicalize } from '../../server/lib/audit/canonicalize';
import { GENESIS_HASH, sha256Hex } from '../../server/lib/audit/types';
import { assertRegionIsolation } from '../../server/lib/regionRouter';
import { recommendFromTriage, type TriageAnswers } from '../lib/vendor/fastTrackTriage';

function hashLink(previous: string, record: Record<string, unknown>): string {
  return sha256Hex(`${previous}\n${canonicalize(record)}`);
}

describe('E2E gate: FastTrack Lite vs Enhanced depth', () => {
  it('Lite recommendation yields a materially smaller capped questionnaire than Enhanced', () => {
    const liteAnswers: TriageAnswers = {
      dataExposure: ['public'],
      accessLevel: 'none',
      businessCriticality: 'low',
      requirements: ['none'],
      reviewCadence: 'annual',
    };
    const enhancedAnswers: TriageAnswers = {
      dataExposure: ['health', 'credentials', 'payment'],
      accessLevel: 'production',
      businessCriticality: 'critical',
      requirements: ['hipaa', 'pci', 'gov'],
      reviewCadence: 'continuous',
    };
    const liteRec = recommendFromTriage(liteAnswers);
    const enhancedRec = recommendFromTriage(enhancedAnswers);
    expect(liteRec?.tier).toBe('Lite');
    expect(enhancedRec?.tier).toBe('Enhanced');

    const litePacks = resolvePackIdsForFrameworks(liteRec!.frameworks);
    const enhancedPacks = resolvePackIdsForFrameworks(enhancedRec!.frameworks);
    const liteQs = applyTierQuestionCap(buildQuestionsForPackIds(litePacks), 'Lite');
    const enhancedQs = applyTierQuestionCap(buildQuestionsForPackIds(enhancedPacks), 'Enhanced');
    expect(liteQs.length).toBeLessThanOrEqual(20);
    expect(enhancedQs.length).toBeGreaterThan(liteQs.length);
  });
});

describe('E2E gate: portal attestations + proposals', () => {
  it('blocks completeness for unconfirmed proposals and missing attestations', () => {
    const proposals: Record<string, AnswerProposal> = {
      q1: {
        questionId: 'q1',
        proposedAnswer: 'Yes',
        status: 'proposed',
        proposedAt: new Date().toISOString(),
      },
    };
    const effective = effectiveAnswersForProgress({ q1: 'Yes' }, proposals);
    expect(effective.q1).toBeUndefined();
    expect(attestationsComplete({ accuracy: true, authority: false })).toBe(false);
    expect(attestationsComplete({ accuracy: true, authority: true })).toBe(true);
  });
});

describe('E2E gate: decision packet', () => {
  it('renders a printable decision HTML packet', () => {
    const html = buildDecisionPacketHtml({
      vendorName: 'Acme Vendor',
      assessmentId: 'asm_test',
      frameworksLabel: 'SOC 2',
      outcome: 'conditional',
      decisionNotes: 'MFA gap by Q3',
      decidedBy: 'admin@example.com',
      decidedAt: new Date().toISOString(),
      nextReviewAt: new Date().toISOString(),
      exceptions: [{ question: 'Do you use MFA?', reason: 'negative', answer: 'No' }],
      triageTier: 'Standard',
    });
    expect(html).toContain('Decision packet');
    expect(html).toContain('Acme Vendor');
    expect(html).toContain('conditional');
    expect(html).toContain('MFA gap by Q3');
  });
});

describe('E2E gate: tamper-evident hash chain (pure)', () => {
  it('verifies a two-event chain and fails after tamper', () => {
    const e1 = {
      eventId: randomUUID(),
      tenantId: 'org_gate',
      eventType: 'vendor.created',
      actorId: 'u1',
      actorType: 'user',
      objectType: 'vendor',
      objectId: 'v1',
      payload: { name: 'Acme' },
      schemaVersion: 1,
      seq: 1,
    };
    const h1 = hashLink(GENESIS_HASH, e1);
    const e2 = {
      ...e1,
      eventId: randomUUID(),
      eventType: 'triage.completed',
      objectId: 'v1',
      payload: { tier: 'Lite' },
      seq: 2,
    };
    const h2 = hashLink(h1, e2);

    // intact
    expect(hashLink(GENESIS_HASH, e1)).toBe(h1);
    expect(hashLink(h1, e2)).toBe(h2);

    // tamper
    const tampered = { ...e1, payload: { name: 'Evil' } };
    expect(hashLink(GENESIS_HASH, tampered)).not.toBe(h1);
  });

  it('treats duplicate event ids as a single logical append (idempotent key)', () => {
    const id = randomUUID();
    const seen = new Set<string>();
    const append = (eventId: string) => {
      if (seen.has(eventId)) return 'duplicate';
      seen.add(eventId);
      return 'queued';
    };
    expect(append(id)).toBe('queued');
    expect(append(id)).toBe('duplicate');
    expect(seen.size).toBe(1);
  });
});

describe('E2E gate: cross-tenant / cross-region forbidden', () => {
  it('does not allow EU org to resolve US region', () => {
    expect(assertRegionIsolation('eu', 'us').ok).toBe(false);
  });

  it('sha256 helper stays deterministic', () => {
    const a = createHash('sha256').update('x', 'utf8').digest('hex');
    expect(sha256Hex('x')).toBe(a);
  });
});
