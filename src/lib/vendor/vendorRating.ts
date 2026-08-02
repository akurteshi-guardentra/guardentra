import { riskLevelFromScore } from './risk';
import type { RiskLevel } from './types';

const LEVEL_RANK: Record<RiskLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

const RANK_LEVEL: RiskLevel[] = ['Low', 'Medium', 'High', 'Critical'];

/** Higher of impact vs security residual — Cynomi-style final vendor rating. */
export function combineImpactAndSecurity(
  impact: RiskLevel | undefined,
  security: RiskLevel | undefined
): RiskLevel | null {
  if (!impact || !security) return null;
  const rank = Math.max(LEVEL_RANK[impact], LEVEL_RANK[security]);
  return RANK_LEVEL[rank - 1];
}

/** Map residual security score (0–100, higher = riskier) to a band. */
export function securityLevelFromScore(score: number | undefined): RiskLevel | undefined {
  if (score == null || score <= 0) return undefined;
  return riskLevelFromScore(score);
}

export function vendorRatingLabel(
  impact?: RiskLevel,
  securityScore?: number
): { ready: boolean; rating: RiskLevel | null; message: string } {
  const security = securityLevelFromScore(securityScore);
  const rating = combineImpactAndSecurity(impact, security);
  if (!impact && !security) {
    return {
      ready: false,
      rating: null,
      message: 'Complete Impact and Security assessments to determine the vendor rating.',
    };
  }
  if (!impact) {
    return { ready: false, rating: null, message: 'Impact assessment required for a final rating.' };
  }
  if (!security) {
    return { ready: false, rating: null, message: 'Security assessment required for a final rating.' };
  }
  return { ready: true, rating, message: `Final rating: ${rating}` };
}
