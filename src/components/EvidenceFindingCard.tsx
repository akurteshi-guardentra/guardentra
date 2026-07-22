import React from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  ArrowRight, 
  ServerCrash, 
  HelpCircle,
  PlusCircle,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { KeyFinding, DetectedRisk } from '../services/EvidenceReviewService';

interface EvidenceFindingCardProps {
  findings: KeyFinding[];
  detectedRisks: DetectedRisk[];
  onRemediate?: (finding: string, recommendation: string) => void;
  isRemediating?: string | null;
}

export function EvidenceFindingCard({
  findings,
  detectedRisks,
  onRemediate,
  isRemediating = null
}: EvidenceFindingCardProps) {

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_8px_-2px_theme(colors.rose.500)]';
      case 'High':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'Low':
      default:
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
  };

  const getRiskMeterColor = (score: number) => {
    if (score >= 80) return 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-emerald-400';
  };

  return (
    <div id="evidence-finding-card" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Target Column 1: Key Findings List */}
      <div className="p-6 rounded-2xl bg-slate-950/40 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ServerCrash className="h-4 w-4 text-rose-400 shrink-0" />
              Key Findings & Violations
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Primary posture anomalies and specific evidence deviations detected by GRC analysis.</p>
          </div>
          <Badge className="bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[9px] font-mono">
            {findings.length} Anomalies
          </Badge>
        </div>

        {findings.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl">
            No compliance exceptions or anomalies identified.
          </div>
        ) : (
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {findings.map((item, index) => (
              <div 
                key={index} 
                className="p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex justify-between items-start gap-4">
                  <p className="text-xs font-semibold text-white leading-relaxed">
                    {item.finding}
                  </p>
                  <span className={`text-[8px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded shrink-0 ${getSeverityBadge(item.severity)}`}>
                    {item.severity}
                  </span>
                </div>

                <div className="text-[11px] leading-relaxed bg-white/[0.01] border border-white/5 rounded-lg p-2.5 text-slate-400">
                  <strong className="text-slate-300 font-medium">Impact Statement: </strong> {item.impact}
                </div>

                {onRemediate && (
                  <Button
                    onClick={() => onRemediate(item.finding, item.impact)}
                    disabled={isRemediating === item.finding}
                    variant="ghost"
                    className="h-7 self-end text-[9px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 mt-1 cursor-pointer select-none"
                  >
                    {isRemediating === item.finding ? (
                      'Filing Remediation...'
                    ) : (
                      <>
                        <PlusCircle className="h-3.5 w-3.5 mr-1" />
                        File Remediation Ticket
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Target Column 2: Vector Risk Mapping */}
      <div className="p-6 rounded-2xl bg-slate-950/40 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-amber-400 shrink-0" />
              Sovereign Risk Vectors
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Quantified impact factors mapped to specific GRC framework sections.</p>
          </div>
          <Badge className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-mono">
            {detectedRisks.length} Vector Points
          </Badge>
        </div>

        {detectedRisks.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl">
            Sovereign risk indexes are clear.
          </div>
        ) : (
          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            {detectedRisks.map((item, index) => (
              <div 
                key={index}
                className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-3"
              >
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <h5 className="text-xs font-bold text-white leading-normal">{item.risk}</h5>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold block mt-1">
                      MAPPED SECTION: {item.coverage}
                    </span>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <span className="text-xs text-slate-500 font-bold">POSTURE DEV:</span>
                    <div className="text-sm font-extrabold text-white">{item.impactScore}%</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-mono text-slate-500">
                    <span>SECTOR STRESS RANGE</span>
                    <span>{item.impactScore >= 70 ? 'CRITICAL EXPOSURE' : item.impactScore >= 40 ? 'EVALUATION REQ.' : 'ACCEPTABLE RANGE'}</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${getRiskMeterColor(item.impactScore)}`}
                      style={{ width: `${item.impactScore}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
