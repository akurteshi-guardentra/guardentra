/**
 * Portal answer proposals (evidence-assisted AI) + attestation helpers.
 * Unconfirmed proposals must not count toward progress/completeness.
 */
export type AnswerProposalStatus = 'proposed' | 'accepted' | 'edited' | 'rejected';

export type AnswerProposal = {
  questionId: string;
  proposedAnswer: string | string[];
  citation?: string;
  confidence?: number;
  sourceFileName?: string;
  status: AnswerProposalStatus;
  proposedAt: string;
  confirmedAt?: string;
  confirmedBy?: string | null;
};

export type PortalAttestations = {
  accuracy: boolean;
  authority: boolean;
  attestedAt?: string;
  attestedByName?: string;
};

export function isProposalConfirmed(p: AnswerProposal | undefined): boolean {
  return p?.status === 'accepted' || p?.status === 'edited';
}

/** Progress for portal: only confirmed answers (or manual answers without open proposals). */
export function effectiveAnswersForProgress(
  answers: Record<string, string | string[] | undefined>,
  proposals: Record<string, AnswerProposal> | undefined
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [qid, value] of Object.entries(answers)) {
    if (value === undefined) continue;
    const prop = proposals?.[qid];
    if (prop && prop.status === 'proposed') continue; // unconfirmed AI does not count
    if (prop && prop.status === 'rejected' && !value) continue;
    out[qid] = value;
  }
  return out;
}

export function attestationsComplete(a: PortalAttestations | null | undefined): boolean {
  return Boolean(a?.accuracy && a?.authority);
}
