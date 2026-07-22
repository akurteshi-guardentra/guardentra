import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { TrustScoreDetails } from '../lib/TrustScoreEngine';
import { cn } from '../lib/utils';

interface TrustScoreCardProps {
  scoreDetails: TrustScoreDetails;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function TrustScoreCard({ scoreDetails, onRefresh, isRefreshing = false }: TrustScoreCardProps) {
  const { overallScore, trend, aiInsights } = scoreDetails;

  // Visual highlights depending on score tier
  const getTierColor = (score: number) => {
    if (score >= 85) return { text: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/10' };
    if (score >= 70) return { text: 'text-indigo-400', border: 'border-indigo-500/20', bg: 'bg-indigo-500/10', glow: 'shadow-indigo-500/10' };
    return { text: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/10', glow: 'shadow-rose-500/10' };
  };

  const colors = getTierColor(overallScore);

  return (
    <Card className="bg-slate-900/40 border-white/5 overflow-hidden relative group backdrop-blur-md">
      {/* Decorative gradient background glow */}
      <div className={cn(
        "absolute -right-24 -top-24 w-60 h-60 rounded-full blur-[80px] pointer-events-none opacity-20 transition-all duration-700 group-hover:opacity-30",
        overallScore >= 85 ? "bg-emerald-500" : overallScore >= 70 ? "bg-indigo-500" : "bg-rose-500"
      )} />

      <CardHeader className="pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Shield className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-xs font-bold font-sans uppercase tracking-[0.2em] text-slate-400">
                Guardentra Trust Index™
              </CardTitle>
              <CardDescription className="text-[10px] text-slate-500">
                Core enterprise integrity & cyber security metric
              </CardDescription>
            </div>
          </div>
          {onRefresh && (
            <button 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 transition-all outline-none"
              title="Recalculate Score"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin text-indigo-400")} />
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
          {/* Circular Progress Gauge */}
          <div className="relative flex items-center justify-center w-32 h-32 flex-shrink-0">
            {/* SVG circle meter */}
            <svg className="w-full h-full transform -rotate-90">
              {/* Outer track */}
              <circle
                cx="64"
                cy="64"
                r="52"
                className="stroke-slate-800 fill-transparent"
                strokeWidth="8"
              />
              {/* Dynamic filled track */}
              <motion.circle
                cx="64"
                cy="64"
                r="52"
                className={cn(
                  "fill-transparent",
                  overallScore >= 85 ? "stroke-emerald-500" : overallScore >= 70 ? "stroke-indigo-500" : "stroke-rose-500"
                )}
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 52}
                initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - overallScore / 100) }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-3xl font-extrabold text-white tracking-tighter block font-display">
                {overallScore}
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block">
                Post-SME
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-3 w-full">
            <div className="flex items-center gap-2">
              <Badge 
                className={cn(
                  "border font-mono scale-95 uppercase font-bold tracking-wider text-[9px] px-2.5 py-0.5",
                  overallScore >= 85 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : overallScore >= 70 
                      ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" 
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                )}
              >
                {overallScore >= 85 ? 'Sovereign Tier' : overallScore >= 70 ? 'In Compliance' : 'Warning Level'}
              </Badge>
              
              {/* Trend Indicator */}
              <div className="flex items-center gap-1 text-[11px] font-medium font-sans">
                {trend.direction === 'up' && (
                  <span className="text-emerald-400 flex items-center font-mono">
                    <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                    +{trend.percentage}%
                  </span>
                )}
                {trend.direction === 'down' && (
                  <span className="text-rose-400 flex items-center font-mono">
                    <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                    -{trend.percentage}%
                  </span>
                )}
                {trend.direction === 'neutral' && (
                  <span className="text-slate-400 font-mono">Stable</span>
                )}
                <span className="text-slate-500 text-[9px] uppercase tracking-wider">this month</span>
              </div>
            </div>

            {/* AI Strategic Explanation Section */}
            {aiInsights && (
              <div className="space-y-1.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-1.5 text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                  AI Explanatory Insights
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {aiInsights.explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
