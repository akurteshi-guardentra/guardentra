import type { RiskLevel, Vendor } from './types';

/** Dark-theme risk bands matching Guardentra UI. */
export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 85) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

export function riskBandClasses(level: RiskLevel): string {
  switch (level) {
    case 'Critical':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    case 'High':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    case 'Medium':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'Low':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  }
}

export function effectiveRiskLevel(vendor: Pick<Vendor, 'criticality' | 'riskScore'>): RiskLevel {
  if (vendor.riskScore > 0) return riskLevelFromScore(vendor.riskScore);
  return vendor.criticality;
}

export function assessmentStatusClasses(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (s.includes('progress')) return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
  if (s.includes('due') && !s.includes('over')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  if (s.includes('overdue')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  if (s.includes('review') || s.includes('sent')) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
  return 'bg-white/5 text-slate-400 border-white/10';
}
