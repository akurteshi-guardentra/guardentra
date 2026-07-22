import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowUpRight, ArrowDownRight, Compass, Target, Landmark, Award } from 'lucide-react';
import { TrustScoreDetails } from '../lib/TrustScoreEngine';
import { cn } from '../lib/utils';

interface TrustScoreTrendProps {
  scoreDetails: TrustScoreDetails;
}

export function TrustScoreTrend({ scoreDetails }: TrustScoreTrendProps) {
  const { overallScore, trend, complianceHealth, vendorRiskHealth, evidenceHealth, controlCoverage, incidentExposure } = scoreDetails;

  // Comparison Medians
  const peerMedian = 76;
  const targetGoal = 95;
  const comparedToPeer = overallScore - peerMedian;

  const getComparisonVerb = (val: number) => {
    if (val > 0) return { text: `+${val} points above average`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (val < 0) return { text: `${val} points below average`, color: 'text-rose-400', bg: 'bg-rose-500/10' };
    return { text: 'equal to industry average', color: 'text-slate-400', bg: 'bg-slate-500/10' };
  };

  const verbResult = getComparisonVerb(comparedToPeer);

  const subTrendIndicators = [
    { name: 'Compliance Progress', value: complianceHealth, change: '+4%', direction: 'up' },
    { name: 'Third-Party Audits', value: vendorRiskHealth, change: '+1%', direction: 'up' },
    { name: 'Policy Execution', value: evidenceHealth, change: '+8%', direction: 'up' },
    { name: 'Active Telemetry', value: controlCoverage, change: '0%', direction: 'neutral' },
    { name: 'Incident Exposure', value: incidentExposure, change: '-5%', direction: 'down' },
  ];

  return (
    <Card className="bg-slate-900/40 border-white/5 backdrop-blur-md overflow-hidden text-white">
      <CardHeader>
        <CardTitle className="text-xs font-bold tracking-[0.2em] uppercase text-slate-400">
          Executive Trend Analysis
        </CardTitle>
        <CardDescription className="text-[10px] text-slate-500">
          Comprehensive market comparison and posture momentum indexes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Marketplace Benchmarking cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 relative overflow-hidden group">
            <Landmark className="absolute -right-2 -bottom-2 h-16 w-16 text-slate-800/20 group-hover:scale-110 transition-transform duration-500" />
            <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Industry Peer Median</p>
            <p className="text-2xl font-bold font-mono mt-1 text-slate-200">{peerMedian}</p>
            <p className="text-[9px] text-slate-400 mt-1 leading-none">Financial & Insurance Sec</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 relative overflow-hidden group">
            <Compass className="absolute -right-2 -bottom-2 h-16 w-16 text-indigo-500/5 group-hover:scale-110 transition-transform duration-500" />
            <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Strategic Position</p>
            <div className={cn("text-2xl font-bold font-mono mt-1 flex items-center gap-1", verbResult.color)}>
              {overallScore}
            </div>
            <span className={cn("inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider", verbResult.bg, verbResult.color)}>
              {verbResult.text}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 relative overflow-hidden group">
            <Target className="absolute -right-2 -bottom-2 h-16 w-16 text-indigo-500/5 group-hover:scale-110 transition-transform duration-500" />
            <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Sovereign Target Goal</p>
            <p className="text-2xl font-bold font-mono mt-1 text-indigo-400">{targetGoal}</p>
            <p className="text-[9px] text-slate-400 mt-1 leading-none">Complete continuous trust state</p>
          </div>
        </div>

        {/* Delta indicators */}
        <div className="space-y-3.5 pt-2">
          <h4 className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-slate-400">
            Sector Posture Momentum
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {subTrendIndicators.map((sub, i) => (
              <div key={i} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                <span className="text-[9px] text-slate-500 font-sans block mb-1 truncate">{sub.name}</span>
                <span className="text-sm font-bold font-mono text-white block">{sub.value}%</span>
                <div className="flex items-center justify-center gap-0.5 mt-1 font-mono text-[9px]">
                  {sub.direction === 'up' && (
                    <span className="text-emerald-400 flex items-center font-bold">
                      <ArrowUpRight className="h-3 w-3" />
                      {sub.change}
                    </span>
                  )}
                  {sub.direction === 'down' && (
                    <span className="text-rose-400 flex items-center font-bold">
                      <ArrowDownRight className="h-3 w-3" />
                      {sub.change}
                    </span>
                  )}
                  {sub.direction === 'neutral' && (
                    <span className="text-slate-500">Stable</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
