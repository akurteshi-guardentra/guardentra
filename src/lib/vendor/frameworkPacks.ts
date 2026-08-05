/**
 * Guardentra-owned framework pack library.
 * Content team publishes new pack versions in-repo; customers never auto-download SDO standards.
 */
import type { FrameworkId } from './types';
import {
  buildQuestionsForFrameworks,
  buildQuestionsFromControlKeys,
  getBankItemByControlKey,
  listBankItems,
  type PortalQuestion,
  QUESTION_BANK_VERSION,
} from './questionBank';

export { QUESTION_BANK_VERSION };

export type FrameworkPackStatus = 'current' | 'superseded' | 'preview';

export interface FrameworkPack {
  packId: string;
  frameworkId: FrameworkId;
  version: string;
  displayName: string;
  releasedAt: string;
  changelog: string;
  status: FrameworkPackStatus;
  /**
   * When set, only these controlKeys ship in the pack (subset of the framework-tagged bank).
   * When omitted, the pack uses every bank item tagged with frameworkId.
   */
  controlKeys?: string[];
}

/** ControlKeys treated as CSF 2.0 / ISO 2022 additions — excluded from superseded packs. */
const CSF_2_ONLY_KEYS = [
  'is_security_posture_reported_to_executives_or_the_board_at_l',
  'is_there_a_defined_incident_severity_classification_and_esca',
  'do_you_run_an_annual_disaster_recovery_tabletop_exercise_wit',
] as const;

const ISO_2022_ONLY_KEYS = [
  'are_data_loss_prevention_dlp_controls_in_place_to_monitor_fo',
  'is_there_a_documented_crisis_communication_plan_for_extended',
  'which_of_the_following_data_protection_controls_are_implemen',
] as const;

function controlKeysForFramework(frameworkId: FrameworkId, exclude: readonly string[] = []): string[] {
  const excludeSet = new Set(exclude);
  return listBankItems()
    .filter((item) => item.frameworks.includes(frameworkId) && !excludeSet.has(item.controlKey))
    .map((item) => item.controlKey);
}

/**
 * Official packs. Side-by-side versions are separate packIds — never rename in place.
 * Content workflow: edit bank/packs → bump QUESTION_BANK_VERSION → ship release notes.
 */
export const FRAMEWORK_PACKS: FrameworkPack[] = [
  {
    packId: 'nist_csf_2@1.1',
    frameworkId: 'nist_csf_2',
    version: '1.1',
    displayName: 'NIST CSF 1.1',
    releasedAt: '2018-04-16',
    changelog:
      'Baseline CSF 1.1 control set. Superseded by CSF 2.0 (Govern function and expanded reporting).',
    status: 'superseded',
    controlKeys: controlKeysForFramework('nist_csf_2', CSF_2_ONLY_KEYS),
  },
  {
    packId: 'nist_csf_2@2.0',
    frameworkId: 'nist_csf_2',
    version: '2.0',
    displayName: 'NIST CSF 2.0',
    releasedAt: '2024-02-26',
    changelog:
      'Adds Govern-oriented executive reporting, severity classification, and DR tabletop controls vs 1.1.',
    status: 'current',
  },
  {
    packId: 'iso27001@2013',
    frameworkId: 'iso27001',
    version: '2013',
    displayName: 'ISO 27001:2013',
    releasedAt: '2013-10-01',
    changelog: 'ISO/IEC 27001:2013 Annex A baseline. Superseded by the 2022 revision.',
    status: 'superseded',
    controlKeys: controlKeysForFramework('iso27001', ISO_2022_ONLY_KEYS),
  },
  {
    packId: 'iso27001@2022',
    frameworkId: 'iso27001',
    version: '2022',
    displayName: 'ISO 27001:2022',
    releasedAt: '2022-10-25',
    changelog: 'Adds DLP, crisis communication, and expanded data-protection control coverage vs 2013.',
    status: 'current',
  },
  {
    packId: 'soc2@current',
    frameworkId: 'soc2',
    version: 'current',
    displayName: 'SOC 2',
    releasedAt: '2026-01-01',
    changelog: 'Guardentra SOC 2 Type II questionnaire pack.',
    status: 'current',
  },
  {
    packId: 'hipaa@current',
    frameworkId: 'hipaa',
    version: 'current',
    displayName: 'HIPAA',
    releasedAt: '2026-01-01',
    changelog: 'Guardentra HIPAA Security Rule questionnaire pack.',
    status: 'current',
  },
  {
    packId: 'pci_dss_4@4.0',
    frameworkId: 'pci_dss_4',
    version: '4.0',
    displayName: 'PCI DSS 4.0',
    releasedAt: '2022-03-31',
    changelog: 'PCI DSS v4.0 questionnaire pack.',
    status: 'current',
  },
  {
    packId: 'cis_controls@current',
    frameworkId: 'cis_controls',
    version: 'current',
    displayName: 'CIS Controls',
    releasedAt: '2026-01-01',
    changelog: 'CIS Controls questionnaire pack.',
    status: 'current',
  },
];

const PACK_BY_ID = new Map(FRAMEWORK_PACKS.map((p) => [p.packId, p]));

export function getPack(packId: string): FrameworkPack | undefined {
  return PACK_BY_ID.get(packId);
}

export function listPacksForFramework(frameworkId: FrameworkId): FrameworkPack[] {
  return FRAMEWORK_PACKS.filter((p) => p.frameworkId === frameworkId);
}

export function getCurrentPack(frameworkId: FrameworkId): FrameworkPack | undefined {
  return FRAMEWORK_PACKS.find((p) => p.frameworkId === frameworkId && p.status === 'current');
}

/** Default packId for a framework family (`{id}@current` semantic via status). */
export function currentPackId(frameworkId: FrameworkId): string | undefined {
  return getCurrentPack(frameworkId)?.packId;
}

export function resolvePackIdsForFrameworks(
  frameworks: FrameworkId[],
  orgDefaults?: Partial<Record<FrameworkId, string>>
): string[] {
  const ids: string[] = [];
  for (const fw of frameworks) {
    if (fw === 'custom') continue;
    const pinned = orgDefaults?.[fw];
    const packId = pinned && PACK_BY_ID.has(pinned) ? pinned : currentPackId(fw);
    if (packId && !ids.includes(packId)) ids.push(packId);
  }
  return ids;
}

export function buildQuestionsForPackIds(packIds: string[]): PortalQuestion[] {
  if (!packIds.length) return [];
  const keySet = new Set<string>();
  const frameworks: FrameworkId[] = [];

  for (const packId of packIds) {
    const pack = PACK_BY_ID.get(packId);
    if (!pack) continue;
    frameworks.push(pack.frameworkId);
    if (pack.controlKeys?.length) {
      for (const k of pack.controlKeys) keySet.add(k);
    } else {
      for (const item of listBankItems()) {
        if (item.frameworks.includes(pack.frameworkId)) keySet.add(item.controlKey);
      }
    }
  }

  if (!keySet.size) {
    return buildQuestionsForFrameworks(frameworks);
  }
  return buildQuestionsFromControlKeys([...keySet]);
}

export interface PackControlDiff {
  added: { controlKey: string; text: string }[];
  removed: { controlKey: string; text: string }[];
  changed: { controlKey: string; fromText: string; toText: string }[];
  unchanged: number;
}

export function diffPacks(fromPackId: string, toPackId: string): PackControlDiff {
  const from = PACK_BY_ID.get(fromPackId);
  const to = PACK_BY_ID.get(toPackId);
  if (!from || !to) {
    return { added: [], removed: [], changed: [], unchanged: 0 };
  }

  const fromKeys = new Set(
    from.controlKeys ?? controlKeysForFramework(from.frameworkId)
  );
  const toKeys = new Set(to.controlKeys ?? controlKeysForFramework(to.frameworkId));

  const added: PackControlDiff['added'] = [];
  const removed: PackControlDiff['removed'] = [];
  const changed: PackControlDiff['changed'] = [];
  let unchanged = 0;

  for (const key of toKeys) {
    const item = getBankItemByControlKey(key);
    if (!fromKeys.has(key)) {
      added.push({ controlKey: key, text: item?.text || key });
    } else {
      unchanged += 1;
    }
  }
  for (const key of fromKeys) {
    if (!toKeys.has(key)) {
      const item = getBankItemByControlKey(key);
      removed.push({ controlKey: key, text: item?.text || key });
    }
  }

  return { added, removed, changed, unchanged };
}

/** Newer current pack available relative to a stamped/pinned packId. */
export function newerCurrentPack(packId: string): FrameworkPack | undefined {
  const pack = PACK_BY_ID.get(packId);
  if (!pack || pack.status === 'current') return undefined;
  return getCurrentPack(pack.frameworkId);
}

export interface RebaselineResult {
  questions: PortalQuestion[];
  carriedAnswers: Record<string, string | string[]>;
  carriedComments: Record<string, string>;
  carriedEvidence: Record<string, unknown[]>;
  unmatchedAnswers: { controlKey: string; questionId: string; answer: string | string[] }[];
  frameworkPackIds: string[];
  questionBankVersion: string;
}

/**
 * Rebuild questions from target packs; copy answers/comments/evidence by controlKey.
 * Existing assessments are never mutated automatically — callers apply this explicitly.
 */
export function rebaselineAssessment(input: {
  questions: Array<{ id: string; controlKey?: string; question?: string }>;
  answers?: Record<string, string | string[]>;
  comments?: Record<string, string>;
  evidenceByQuestion?: Record<string, unknown[]>;
  targetPackIds: string[];
}): RebaselineResult {
  const questions = buildQuestionsForPackIds(input.targetPackIds);
  const oldByKey = new Map<
    string,
    { id: string; answer?: string | string[]; comment?: string; evidence?: unknown[] }
  >();
  const unmatchedAnswers: RebaselineResult['unmatchedAnswers'] = [];
  const carriedAnswers: Record<string, string | string[]> = {};
  const carriedComments: Record<string, string> = {};
  const carriedEvidence: Record<string, unknown[]> = {};

  for (const q of input.questions) {
    const answer = input.answers?.[q.id];
    const comment = input.comments?.[q.id];
    const evidence = input.evidenceByQuestion?.[q.id];
    const key = q.controlKey;
    if (!key) {
      // No controlKey → cannot remap onto new q_* ids; keep an audit trail instead of dropping.
      if (answer !== undefined && isAnswerPresent(answer)) {
        unmatchedAnswers.push({ controlKey: '', questionId: q.id, answer });
      }
      if (typeof comment === 'string' && comment.trim()) {
        carriedComments[q.id] = comment;
      }
      if (Array.isArray(evidence) && evidence.length > 0) {
        carriedEvidence[q.id] = evidence;
      }
      continue;
    }
    oldByKey.set(key, { id: q.id, answer, comment, evidence });
  }

  const usedOldKeys = new Set<string>();

  for (const q of questions) {
    const prev = oldByKey.get(q.controlKey);
    if (!prev) continue;
    if (prev.answer !== undefined && isAnswerPresent(prev.answer)) {
      carriedAnswers[q.id] = prev.answer;
      usedOldKeys.add(q.controlKey);
    }
    if (typeof prev.comment === 'string' && prev.comment.trim()) {
      carriedComments[q.id] = prev.comment;
      usedOldKeys.add(q.controlKey);
    }
    if (Array.isArray(prev.evidence) && prev.evidence.length > 0) {
      carriedEvidence[q.id] = prev.evidence.map((item) =>
        item && typeof item === 'object' ? { ...item, questionId: q.id } : item
      );
      usedOldKeys.add(q.controlKey);
    }
  }

  for (const [key, prev] of oldByKey) {
    if (usedOldKeys.has(key)) continue;
    if (prev.answer !== undefined && isAnswerPresent(prev.answer)) {
      unmatchedAnswers.push({ controlKey: key, questionId: prev.id, answer: prev.answer });
    }
    // Preserve orphaned comment/evidence under the old question id so data is not deleted.
    if (typeof prev.comment === 'string' && prev.comment.trim()) {
      carriedComments[prev.id] = prev.comment;
    }
    if (Array.isArray(prev.evidence) && prev.evidence.length > 0) {
      carriedEvidence[prev.id] = prev.evidence;
    }
  }

  return {
    questions,
    carriedAnswers,
    carriedComments,
    carriedEvidence,
    unmatchedAnswers,
    frameworkPackIds: input.targetPackIds,
    questionBankVersion: QUESTION_BANK_VERSION,
  };
}

function isAnswerPresent(value: string | string[]): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

/** Packs that have a newer current version than the org pin (or vs current if unpinned). */
export function packsNeedingUpgradeNotice(
  orgDefaults: Partial<Record<FrameworkId, string>> | undefined
): { pinnedPackId: string; current: FrameworkPack; diff: PackControlDiff }[] {
  const notices: { pinnedPackId: string; current: FrameworkPack; diff: PackControlDiff }[] = [];
  const frameworkIds = new Set(FRAMEWORK_PACKS.map((p) => p.frameworkId));

  for (const frameworkId of frameworkIds) {
    if (frameworkId === 'custom') continue;
    const pinned = orgDefaults?.[frameworkId];
    if (!pinned) continue;
    const newer = newerCurrentPack(pinned);
    if (!newer) continue;
    notices.push({
      pinnedPackId: pinned,
      current: newer,
      diff: diffPacks(pinned, newer.packId),
    });
  }
  return notices;
}
