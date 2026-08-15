import { beforeEach, describe, expect, it } from 'vitest';
import {
  syncVendorAfterAssessmentApprove,
  syncVendorAfterAssessmentCreate,
  syncVendorAfterAssessmentProgress,
  syncVendorAfterAssessmentSubmit,
} from '../lib/vendor/syncVendorAssessment';
import {
  createLocalVendor,
  listLocalVendors,
  replaceLocalVendors,
} from '../lib/vendor/localVendorStore';
import {
  createLocalAssessment,
  deriveStatusFromAssessments,
  listLocalAssessments,
  listLocalAssessmentsForVendor,
  replaceLocalAssessments,
  upsertLocalAssessment,
} from '../lib/vendor/localAssessmentStore';
import {
  buildArchiveEmptyAssessmentPatch,
  buildRecoverEmptyAssessmentPatch,
} from '../lib/vendor/emptyAssessmentRecovery';
import {
  buildCreateAssessmentFields,
  buildOrgCorrectionReopenPatch,
  buildOrgDecisionPatch,
  buildPortalAutosavePatch,
  buildPortalSubmitPatch,
  canSignOffAssessment,
  decisionRequiresNotes,
  hasTerminalOrgDecision,
  isReceiptMode,
  isTerminalDecisionOutcome,
  nextReviewAtForDecision,
} from '../lib/vendor/assessmentLifecycle';
import {
  buildQuestionsForPackIds,
  resolvePackIdsForFrameworks,
} from '../lib/vendor/frameworkPacks';
import { assessmentStatusClasses } from '../lib/vendor/risk';
import type { PortalQuestion } from '../lib/vendor/questionBank';

/**
 * Portal ↔ tracker integration-style coverage (no live Firebase):
 * wizard create helpers → local row → autosave In Progress → submit Under Review
 * (not Completed) → org Approve / Remediate / Reject chips + vendor sync.
 */
describe('vendor assessment portal/tracker lifecycle', () => {
  const orgId = 'org-lifecycle';

  beforeEach(() => {
    replaceLocalVendors(orgId, []);
    replaceLocalAssessments(orgId, []);
  });

  function seedVendorAndAssessment(questions?: PortalQuestion[]) {
    const vendor = createLocalVendor(orgId, {
      name: 'Lifecycle Co',
      category: 'SaaS',
      criticality: 'High',
    });
    const packIds = resolvePackIdsForFrameworks(['soc2']);
    const qs = questions ?? buildQuestionsForPackIds(packIds).slice(0, 3);
    const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const fields = buildCreateAssessmentFields({
      vendorId: vendor.id,
      vendorName: vendor.name,
      organizationId: orgId,
      frameworks: ['soc2'],
      frameworkPackIds: packIds,
      frameworkName: 'SOC 2',
      questions: qs,
      sourceQuestionCount: qs.length,
      dueAt,
      nowIso: '2026-08-05T12:00:00.000Z',
    });
    const assessment = createLocalAssessment(orgId, {
      vendorId: fields.vendorId,
      vendorName: fields.vendorName,
      frameworks: fields.frameworks,
      frameworkPackIds: fields.frameworkPackIds,
      questionBankVersion: fields.questionBankVersion,
      frameworkName: fields.frameworkName,
      status: fields.status,
      dueAt: fields.dueAt,
      questionCount: fields.questionCount,
      sourceQuestionCount: fields.sourceQuestionCount,
      questions: fields.questions,
    });
    return { vendor, assessment, questions: qs, fields };
  }

  it('create fields stamp Sent + portalOpen + zero progress (wizard/cloud shape)', () => {
    const packIds = resolvePackIdsForFrameworks(['soc2']);
    const questions = buildQuestionsForPackIds(packIds).slice(0, 2);
    const fields = buildCreateAssessmentFields({
      vendorId: 'v1',
      vendorName: 'Acme',
      organizationId: orgId,
      frameworks: ['soc2'],
      frameworkPackIds: packIds,
      frameworkName: 'SOC 2',
      questions,
      dueAt: '2026-08-19T12:00:00.000Z',
      nowIso: '2026-08-05T12:00:00.000Z',
    });
    expect(fields.status).toBe('Sent');
    expect(fields.portalOpen).toBe(true);
    expect(fields.progressPct).toBe(0);
    expect(fields.questionCount).toBe(2);
    expect(fields.dueDate).toBe('2026-08-19');
    expect(fields.questions).toHaveLength(2);
  });

  it('runs create → autosave → submit → approve with matching tracker + vendor chips', async () => {
    const { vendor, assessment, questions } = seedVendorAndAssessment();

    await syncVendorAfterAssessmentCreate(orgId, vendor.id, true);
    expect(listLocalVendors(orgId)[0]?.assessmentStatus).toBe('Sent');
    expect(assessment.status).toBe('Sent');
    expect(assessment.portalOpen).toBe(true);
    expect(canSignOffAssessment(assessment)).toBe(false);

    // Autosave first answer — In Progress, never Completed / Under Review
    const draft = buildPortalAutosavePatch({
      questions,
      answers: { [questions[0].id]: 'Yes' },
      comments: {},
      evidenceByQuestion: {},
      nowIso: '2026-08-05T12:05:00.000Z',
    });
    expect(draft.status).toBe('In Progress');
    expect(draft.progressPct).toBeGreaterThan(0);
    expect(draft.status).not.toBe('Completed' as never);

    const inProgress = upsertLocalAssessment(orgId, {
      ...assessment,
      ...draft,
      questions,
    });
    await syncVendorAfterAssessmentProgress(orgId, vendor.id, true);
    expect(listLocalVendors(orgId)[0]?.assessmentStatus).toBe('In Progress');
    expect(
      deriveStatusFromAssessments([
        { status: inProgress.status, progressPct: inProgress.progressPct },
      ])
    ).toBe('In Progress');
    expect(canSignOffAssessment(inProgress)).toBe(true);

    // Answer remaining required questions and submit
    const allYes = Object.fromEntries(questions.map((q) => [q.id, 'Yes']));
    const submit = buildPortalSubmitPatch({
      answers: allYes,
      comments: {},
      evidenceByQuestion: {},
      nowIso: '2026-08-05T13:00:00.000Z',
    });
    expect(submit.status).toBe('Under Review');
    expect(submit.progressPct).toBe(100);
    expect(submit.portalOpen).toBe(false);
    expect(submit.submittedSnapshot.answers).toEqual(submit.answers);
    expect(submit.submittedSnapshot.submittedAt).toBe('2026-08-05T13:00:00.000Z');
    expect(submit.status).not.toBe('Completed' as never);

    const underReview = upsertLocalAssessment(orgId, {
      ...inProgress,
      ...submit,
      questions,
    });
    expect(underReview.portalOpen).toBe(false);
    expect(underReview.submittedSnapshot?.answers).toEqual(submit.answers);
    await syncVendorAfterAssessmentSubmit(orgId, vendor.id, true);
    expect(listLocalVendors(orgId)[0]?.assessmentStatus).toBe('Under Review');
    expect(
      deriveStatusFromAssessments([
        { status: underReview.status, progressPct: underReview.progressPct },
      ])
    ).toBe('Under Review');
    expect(assessmentStatusClasses('Under Review')).toMatch(/indigo/);

    // Org approve closes portal + vendor Completed
    const decision = buildOrgDecisionPatch({
      outcome: 'approved',
      decidedBy: 'admin@example.com',
      nowIso: '2026-08-05T14:00:00.000Z',
    });
    expect(decision.status).toBe('Completed');
    expect(decision.portalOpen).toBe(false);
    expect(decision.decisionOutcome).toBe('approved');
    expect(Object.prototype.hasOwnProperty.call(decision, 'decisionNotes')).toBe(false);

    const closed = upsertLocalAssessment(orgId, { ...underReview, ...decision });
    const nextReview = nextReviewAtForDecision('approved', new Date('2026-08-05T14:00:00.000Z'));
    await syncVendorAfterAssessmentApprove(orgId, vendor.id, true, nextReview);

    expect(closed.status).toBe('Completed');
    expect(closed.portalOpen).toBe(false);
    expect(listLocalVendors(orgId)[0]?.assessmentStatus).toBe('Completed');
    expect(listLocalVendors(orgId)[0]?.nextReviewAt).toBe(nextReview);
    expect(listLocalAssessmentsForVendor(orgId, vendor.id)).toHaveLength(1);
    expect(listLocalAssessments(orgId)[0]?.decisionOutcome).toBe('approved');
  });

  it('autosave with zero answers stays Sent (no premature In Progress)', () => {
    const questions = buildQuestionsForPackIds(resolvePackIdsForFrameworks(['soc2'])).slice(0, 2);
    const draft = buildPortalAutosavePatch({
      questions,
      answers: {},
      comments: {},
      evidenceByQuestion: {},
    });
    expect(draft.status).toBe('Sent');
    expect(draft.progressPct).toBe(0);
  });

  it('remediate keeps Under Review + portal open; reject closes like approve', async () => {
    const { vendor, assessment, questions } = seedVendorAndAssessment();
    await syncVendorAfterAssessmentCreate(orgId, vendor.id, true);

    const submitted = upsertLocalAssessment(orgId, {
      ...assessment,
      ...buildPortalSubmitPatch({
        answers: Object.fromEntries(questions.map((q) => [q.id, 'No'])),
        comments: {},
        evidenceByQuestion: {},
      }),
      questions,
    });
    await syncVendorAfterAssessmentSubmit(orgId, vendor.id, true);

    expect(decisionRequiresNotes('remediate')).toBe(true);
    expect(decisionRequiresNotes('approved')).toBe(false);

    const remediate = buildOrgDecisionPatch({
      outcome: 'remediate',
      decidedBy: 'admin@example.com',
      decisionNotes: 'Fix MFA gaps',
      nowIso: '2026-08-05T15:00:00.000Z',
    });
    expect(remediate.status).toBe('Under Review');
    expect(remediate.portalOpen).toBe(true);
    expect(remediate.decisionOutcome).toBe('remediate');
    expect(remediate.decisionNotes).toBe('Fix MFA gaps');
    expect(hasTerminalOrgDecision(remediate)).toBe(false);
    expect(isTerminalDecisionOutcome('remediate')).toBe(false);
    expect(isTerminalDecisionOutcome('approved')).toBe(true);

    const remRow = upsertLocalAssessment(orgId, { ...submitted, ...remediate });
    // Vendor chip stays Under Review — approve sync is only for closing outcomes
    expect(listLocalVendors(orgId)[0]?.assessmentStatus).toBe('Under Review');
    expect(
      deriveStatusFromAssessments([
        { status: remRow.status, progressPct: remRow.progressPct ?? 100 },
      ])
    ).toBe('Under Review');

    const rejected = buildOrgDecisionPatch({
      outcome: 'rejected',
      decidedBy: 'admin@example.com',
      nowIso: '2026-08-05T16:00:00.000Z',
    });
    expect(rejected.status).toBe('Completed');
    expect(rejected.portalOpen).toBe(false);
    expect(rejected.decisionOutcome).toBe('rejected');
    expect(Object.prototype.hasOwnProperty.call(rejected, 'decisionNotes')).toBe(false);

    upsertLocalAssessment(orgId, { ...remRow, ...rejected });
    await syncVendorAfterAssessmentApprove(
      orgId,
      vendor.id,
      true,
      nextReviewAtForDecision('rejected')
    );
    expect(listLocalVendors(orgId)[0]?.assessmentStatus).toBe('Completed');
  });

  it('conditional approval schedules a 6-month next review', () => {
    const from = new Date('2026-08-05T12:00:00.000Z');
    const next = new Date(nextReviewAtForDecision('conditional', from));
    expect(next.getUTCMonth()).toBe((from.getUTCMonth() + 6) % 12);
    const annual = new Date(nextReviewAtForDecision('approved', from));
    expect(annual.getUTCFullYear()).toBe(from.getUTCFullYear() + 1);
  });

  it('keeps Under Review badge when progress is 100 (portal submit shape)', () => {
    expect(
      deriveStatusFromAssessments([{ status: 'Under Review', progressPct: 100 }])
    ).toBe('Under Review');
  });

  it('submit closes portal; org correction reopen returns vendor to editable questionnaire and keeps snapshot', () => {
    const questions = buildQuestionsForPackIds(resolvePackIdsForFrameworks(['soc2'])).slice(0, 2);
    const answers = Object.fromEntries(questions.map((q) => [q.id, 'Yes']));
    const submit = buildPortalSubmitPatch({
      answers,
      comments: { [questions[0].id]: 'note' },
      evidenceByQuestion: {},
      nowIso: '2026-08-05T13:00:00.000Z',
    });
    expect(submit.portalOpen).toBe(false);
    expect(submit.submittedSnapshot.comments).toEqual({ [questions[0].id]: 'note' });

    const submittedDoc = {
      ...submit,
      submittedSnapshot: submit.submittedSnapshot,
    };
    expect(isReceiptMode(submittedDoc)).toBe(true);

    const reopen = buildOrgCorrectionReopenPatch({
      reopenedBy: 'admin@example.com',
      reason: 'Vendor omitted SOC 2 CC6.1 evidence',
      nowIso: '2026-08-06T09:00:00.000Z',
    });
    expect(reopen.portalOpen).toBe(true);
    expect(reopen.status).toBe('In Progress');
    expect(reopen.correctionReopenedBy).toBe('admin@example.com');
    expect(reopen.correctionReason).toContain('evidence');
    expect('submittedSnapshot' in reopen).toBe(false);
    expect('completedAt' in reopen).toBe(false);

    const reopenedDoc = { ...submittedDoc, ...reopen };
    expect(isReceiptMode(reopenedDoc)).toBe(false);
    expect(reopenedDoc.status).toBe('In Progress');
    expect(reopenedDoc.portalOpen).toBe(true);
    expect(reopenedDoc.completedAt).toBe(submit.completedAt);
    expect(reopenedDoc.submittedSnapshot).toEqual(submit.submittedSnapshot);

    const laterAnswers = { ...answers, [questions[1].id]: 'No' };
    const correctionEdit = buildPortalAutosavePatch({
      questions,
      answers: laterAnswers,
      comments: { [questions[0].id]: 'updated after reopen' },
      evidenceByQuestion: {},
    });
    const afterEdit = { ...reopenedDoc, ...correctionEdit };
    expect(afterEdit.submittedSnapshot).toEqual(submit.submittedSnapshot);
    expect(afterEdit.answers[questions[1].id]).toBe('No');
    expect(isReceiptMode(afterEdit)).toBe(false);
  });

  it('recovery patch restores a usable Sent-ready questionnaire; archive closes chips', () => {
    const recovered = buildRecoverEmptyAssessmentPatch({
      frameworks: ['soc2'],
      questions: [],
    });
    expect(recovered.questions.length).toBeGreaterThan(0);
    expect(recovered.portalOpen).toBe(true);
    expect(
      deriveStatusFromAssessments([{ status: 'Sent', progressPct: recovered.progressPct }])
    ).toBe('Sent');

    const archived = buildArchiveEmptyAssessmentPatch({
      reason: 'No packs — custom-only legacy',
      archivedBy: 'admin@example.com',
    });
    expect(
      deriveStatusFromAssessments([
        { status: archived.status, progressPct: archived.progressPct },
      ])
    ).toBe('Completed');
  });

  it('submit still preserves submittedSnapshot when evidence is untrusted', () => {
    const pending = [
      {
        fileName: 'policy.pdf',
        storagePath: 'portal/asm/x.pdf',
      },
    ];
    const submit = buildPortalSubmitPatch({
      answers: { q1: 'Yes' },
      comments: {},
      evidenceByQuestion: { q1: pending },
      nowIso: '2026-08-15T13:00:00.000Z',
    });
    expect(submit.portalOpen).toBe(false);
    expect(submit.status).toBe('Under Review');
    expect(submit.submittedSnapshot.evidenceByQuestion.q1).toEqual(pending);
  });
});

describe('buildOrgDecisionPatch omits absent decisionNotes', () => {
  it('omits decisionNotes for rejected and approved without notes', () => {
    const rejected = buildOrgDecisionPatch({
      outcome: 'rejected',
      decidedBy: 'u1',
    });
    expect(Object.prototype.hasOwnProperty.call(rejected, 'decisionNotes')).toBe(false);
    expect(rejected.decisionOutcome).toBe('rejected');
    expect(rejected.decidedAt).toBeTruthy();
    expect(rejected.decidedBy).toBe('u1');
    expect(rejected.portalOpen).toBe(false);
    expect(rejected.status).toBe('Completed');

    const approved = buildOrgDecisionPatch({
      outcome: 'approved',
      decidedBy: 'u1',
    });
    expect(Object.prototype.hasOwnProperty.call(approved, 'decisionNotes')).toBe(false);
    expect(approved.decisionOutcome).toBe('approved');
    expect(approved.decidedAt).toBeTruthy();
    expect(approved.decidedBy).toBe('u1');
  });

  it('includes decisionNotes for conditional and remediate with notes', () => {
    const conditional = buildOrgDecisionPatch({
      outcome: 'conditional',
      decidedBy: 'u1',
      decisionNotes: 'conditions apply',
    });
    expect(conditional.decisionNotes).toBe('conditions apply');
    expect(conditional.portalOpen).toBe(false);

    const remediate = buildOrgDecisionPatch({
      outcome: 'remediate',
      decidedBy: 'u1',
      decisionNotes: 'fix gaps',
    });
    expect(remediate.decisionNotes).toBe('fix gaps');
    expect(remediate.portalOpen).toBe(true);
    expect(remediate.status).toBe('Under Review');
  });
});
