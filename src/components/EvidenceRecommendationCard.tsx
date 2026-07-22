import React from 'react';
import { 
  CheckCircle,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Recommendation } from '../services/EvidenceReviewService';

interface EvidenceRecommendationCardProps {
  recommendations: Recommendation[];
  onAddActionItem?: (targetAction: string, timeframe: string, difficulty: string) => void;
  activeAddedItems?: string[];
}

export function EvidenceRecommendationCard({
  recommendations,
  onAddActionItem,
  activeAddedItems = []
}: EvidenceRecommendationCardProps) {

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'Moderate':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'Complex':
      default:
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    }
  };

  return (
    <div id="evidence-recommendation-card" className="p-6 rounded-2xl bg-slate-950/40 border border-white/5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-emerald-400 shrink-0" />
            Recommended Next Actions
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Sovereign compliance advice and steps prescribed to optimize this vendor's security rating.</p>
        </div>
        <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9px] font-mono">
          {recommendations.length} Steps
        </Badge>
      </div>

      {recommendations.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl">
          No prescriptive next steps are recommended at this time.
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((item, index) => {
            const isAdded = activeAddedItems.includes(item.action);

            return (
              <div 
                key={index} 
                className="p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <p className="text-xs font-semibold text-white leading-relaxed">
                    {item.action}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center text-[10px] text-slate-500 gap-1 font-mono font-bold">
                      <Clock className="h-3 w-3 text-indigo-400" />
                      TIMEFRAME: <span className="text-slate-300">{item.timeframe}</span>
                    </span>

                    <span className="text-[10px] text-slate-500 font-mono font-bold flex items-center gap-1">
                      <Info className="h-3 w-3 text-indigo-400" />
                      DIFFICULTY:
                      <Badge className={`text-[8px] font-bold uppercase py-0.5 px-1.5 border hover:bg-transparent ${getDifficultyColor(item.difficulty)}`}>
                        {item.difficulty}
                      </Badge>
                    </span>
                  </div>
                </div>

                {onAddActionItem && (
                  <Button
                    onClick={() => !isAdded && onAddActionItem(item.action, item.timeframe, item.difficulty)}
                    disabled={isAdded}
                    className={`h-8 px-4 text-[10px] uppercase font-bold tracking-wider cursor-pointer select-none shrink-0 transition-all ${
                      isAdded
                        ? 'border-emerald-500/15 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/5'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                        Remediation Logged
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5 mr-1 text-yellow-400 animate-pulse" />
                        Log Action Ticket
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
