import type { RiskLevel, Vendor } from './types';

/** Mockup risk bands: higher score = higher risk (Critical 92, High 81, …). */
export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 85) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

export function riskBandClasses(level: RiskLevel): string {
  switch (level) {
    case 'Critical':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'High':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Medium':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Low':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
}

export function effectiveRiskLevel(vendor: Pick<Vendor, 'criticality' | 'riskScore'>): RiskLevel {
  if (vendor.riskScore > 0) return riskLevelFromScore(vendor.riskScore);
  return vendor.criticality;
}

export function assessmentStatusClasses(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete')) return 'bg-emerald-100 text-emerald-700';
  if (s.includes('progress')) return 'bg-sky-100 text-sky-700';
  if (s.includes('due')) return 'bg-orange-100 text-orange-700';
  if (s.includes('overdue')) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}
