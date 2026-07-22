import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Bookmark, Percent, Activity, FileCheck, ShieldAlert, Zap, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { TrustScoreDetails } from '../lib/TrustScoreEngine';
import { cn } from '../lib/utils';

interface TrustScoreBreakdownProps {
  scoreDetails: TrustScoreDetails;
}

export function TrustScoreBreakdown({ scoreDetails }: TrustScoreBreakdownProps) {
  const {
    complianceHealth,
    vendorRiskHealth,
    evidenceHealth,
    controlCoverage,
    incidentExposure,
    aiInsights
  } = scoreDetails;

  // Breakdown segments for mapping
  const components = [
    {
      id: 'compliance',
      name: 'Compliance Health',
      weight: 30,
      score: complianceHealth,
      icon: FileCheck,
      colorClass: 'bg-emerald-500',
      textColorClass: 'text-emerald-400',
      description: 'Framework assessment progress (ISO 27001, SOC 2)'
    },
    {
      id: 'vendor',
      name: 'Vendor Risk Health',
      weight: 25,
      score: vendorRiskHealth,
      icon: Layers,
      colorClass: 'bg-indigo-500',
      textColorClass: 'text-indigo-400',
      description: 'Collated rating posture of all mapped vendors'
    },
    {
      id: 'evidence',
      name: 'Evidence Health',
      weight: 20,
      score: evidenceHealth,
      icon: Bookmark,
      colorClass: 'bg-cyan-500',
      textColorClass: 'text-cyan-400',
      description: 'Completion ratio of verified active safety policies'
    },
    {
      id: 'control',
      name: 'Control Coverage',
      weight: 15,
      score: controlCoverage,
      icon: Zap,
      colorClass: 'bg-amber-500',
      textColorClass: 'text-amber-400',
      description: 'Continuous automated platform checks active'
    },
    {
      id: 'incident',
      name: 'Incident Exposure',
      weight: 10,
      score: incidentExposure,
      icon: ShieldAlert,
      colorClass: 'bg-rose-500',
      textColorClass: 'text-rose-400',
      description: 'Risk factor from active security incidences'
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-white">
      {/* Component Progression Bars */}
      <Card className="bg-slate-900/40 border-white/5 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-sm font-bold tracking-[0.2em] uppercase text-slate-400">
            Weighted Component Matrix
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Underlying score values factored by mathematical risk weights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {components.map((comp) => {
            const CompIcon = comp.icon;
            return (
              <div key={comp.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1 rounded bg-white/[0.03] border border-white/5", comp.textColorClass)}>
                      <CompIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        {comp.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 leading-none">
                        {comp.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-white block">
                      {comp.score}%
                    </span>
                    <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">
                      Weight: {comp.weight}%
                    </span>
                  </div>
                </div>

                {/* Progress Tracks */}
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className={cn("h-full", comp.colorClass)}
                    initial={{ width: 0 }}
                    animate={{ width: `${comp.score}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Driver List (Positive / Negative Contributing Factors) */}
      <Card className="bg-slate-900/40 border-white/5 backdrop-blur-md flex flex-col justify-between">
        <CardHeader>
          <CardTitle className="text-sm font-bold tracking-[0.2em] uppercase text-slate-400">
            Calculated Positives & Gaps
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Drivers analyzed directly from current enterprise posture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Positive Drivers */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-1.5 pb-2 border-b border-emerald-500/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Positive Drivers
              </h4>
              <ul className="space-y-2.5">
                {aiInsights?.positives.map((pos, idx) => (
                  <li key={idx} className="text-xs text-slate-300 leading-relaxed flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-1 select-none font-mono font-bold">•</span>
                    {pos}
                  </li>
                ))}
              </ul>
            </div>

            {/* Negative Drivers */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-[0.2em] flex items-center gap-1.5 pb-2 border-b border-rose-500/10">
                <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                Posture Gaps
              </h4>
              <ul className="space-y-2.5">
                {aiInsights?.negatives.map((neg, idx) => (
                  <li key={idx} className="text-xs text-slate-300 leading-relaxed flex items-start gap-1.5 font-sans">
                    <span className="text-rose-400 mt-1 select-none font-mono font-bold">•</span>
                    {neg}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Practical Next Steps recommendation board */}
          {aiInsights?.nextSteps && (
            <div className="pt-6 border-t border-white/5 mt-6 space-y-3.5">
              <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-indigo-400" />
                Recommended Remediation Queue
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {aiInsights.nextSteps.map((step, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15 hover:border-indigo-500/30 transition-all flex items-start gap-3"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-xs text-slate-300 leading-normal font-sans">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
