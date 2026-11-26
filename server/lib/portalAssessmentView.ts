import { VENDOR_PRIVATE_ASSESSMENT_FIELDS } from '../../src/lib/vendor/vendorAssessmentPrivacy';

type Data = Record<string, unknown>;
const object = (value: unknown): Data =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};

// Finite field selection also excludes unknown future internal fields; do not
// spread a complete Admin SDK document into a vendor response.
function pick(data: Data, fields: readonly string[]): Data {
  return Object.fromEntries(fields.flatMap(key => {
    const value = data[key];
    if (typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      (Array.isArray(value) && value.every(item => typeof item === 'string'))) {
      return [[key, value]];
    }
    return [];
  }));
}
function mapValues(value: unknown, project: (value: unknown) => unknown): Data {
  return Object.fromEntries(Object.entries(object(value)).map(([key, item]) => [key, project(item)]));
}

export function hasPrivateReviewerFields(data: Data): boolean {
  return VENDOR_PRIVATE_ASSESSMENT_FIELDS.some(key => Object.hasOwn(data, key));
}

export function portalAssessmentReadable(data: Data): boolean {
  return data.portalOpen === true || data.status === 'Under Review' ||
    data.status === 'Completed' || Boolean(data.completedAt);
}

export function buildPortalAssessmentView(data: Data): Data {
  const view = pick(data, [
    'organizationId', 'vendorId', 'vendorName', 'requesterOrgName', 'requesterLogoUrl',
    'status', 'portalOpen', 'decisionOutcome', 'frameworkName', 'frameworks',
    'questionCount', 'sourceQuestionCount', 'progressPct', 'progress',
  ]);
  for (const key of ['completedAt', 'createdAt', 'updatedAt', 'decidedAt',
    'correctionReopenedAt', 'remediationDueAt', 'dueAt', 'dueDate']) {
    const value = data[key];
    if (typeof value === 'string') view[key] = value;
    else if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      const date = (value as { toDate(): Date }).toDate();
      if (Number.isFinite(date.getTime())) view[key] = date.toISOString();
    }
  }
  if (Array.isArray(data.questions)) view.questions = data.questions.map(q => pick(object(q), [
    'id', 'controlKey', 'category', 'question', 'text', 'type', 'options', 'required',
  ]));
  view.answers = mapValues(data.answers, answer =>
    typeof answer === 'string' || (Array.isArray(answer) && answer.every(a => typeof a === 'string')) ? answer : '');
  view.comments = mapValues(data.comments, comment => typeof comment === 'string' ? comment : '');
  view.evidenceByQuestion = mapValues(data.evidenceByQuestion, items =>
    Array.isArray(items) ? items.map(item => pick(object(item), [
      'fileName', 'contentType', 'sizeBytes', 'storagePath', 'uploadedAt', 'questionId',
    ])) : []);
  view.evidenceTrustByStoragePath = mapValues(data.evidenceTrustByStoragePath, record => {
    if (typeof record === 'string') return record;
    const trust = object(record);
    const result = pick(trust, ['state', 'storagePath', 'contentType', 'sizeBytes', 'generation', 'updatedAt', 'validation']);
    if (trust.scanner) result.scanner = pick(object(trust.scanner), ['engine', 'verdict', 'signature', 'scannedAt']);
    return result;
  });
  view.answerProposals = mapValues(data.answerProposals, proposal => pick(object(proposal), [
    'questionId', 'proposedAnswer', 'citation', 'confidence', 'sourceFileName', 'status',
    'proposedAt', 'confirmedAt', 'confirmedBy',
  ]));
  view.attestations = pick(object(data.attestations), ['accuracy', 'authority', 'attestedAt', 'attestedByName']);
  return view;
}
