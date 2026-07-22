import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sparkles, Loader2, ArrowRight, HelpCircle, Activity } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { calculateTrustScore, TrustScoreDetails } from '../lib/TrustScoreEngine';
import { TrustScoreCard } from '../components/TrustScoreCard';
import { TrustScoreBreakdown } from '../components/TrustScoreBreakdown';
import { TrustScoreHistory } from '../components/TrustScoreHistory';
import { TrustScoreTrend } from '../components/TrustScoreTrend';
import { Button } from '../components/ui/button';

export function TrustIntelligence() {
  const { profile, loading: authLoading } = useAuth();
  const [loadingScore, setLoadingScore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scoreDetails, setScoreDetails] = useState<TrustScoreDetails | null>(null);

  const fetchScoreMetric = async (refresh = false) => {
    if (!profile?.organizationId) return;
    if (refresh) setIsRefreshing(true);
    else setLoadingScore(true);

    try {
      const details = await calculateTrustScore(profile.organizationId);
      setScoreDetails(details);
    } catch (e) {
      console.error("Failed to load Trust Score intelligence:", e);
    } finally {
      setLoadingScore(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchScoreMetric();
  }, [profile?.organizationId, authLoading]);

  // Framer Motion constraints
  const containerVariants: any = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.1,
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 }
  };

  if (authLoading || loadingScore) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
        <div>
          <h3 className="text-lg font-bold text-white font-display">Simulating Multi-Factor Posture Index...</h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5 uppercase tracking-widest">Compiling active cloud telemetry grids</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-8 animate-in fade-in duration-500"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display flex items-center gap-2">
            Trust Intelligence Center
            <span className="text-[10px] uppercase font-mono font-bold tracking-[0.2em] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded">
              Engine Active
            </span>
          </h1>
          <p className="text-slate-400 mt-1">
            Explainable strategic risk assessment, metric historical benchmarks, and remediation directives.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-xs uppercase font-bold tracking-widest border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 h-11 px-5 rounded-xl"
            onClick={() => {
              const askButton = document.querySelector('button[onClick*="setIsCopilotOpen"]');
              if (askButton) (askButton as any).click();
            }}
          >
            <Sparkles className="h-4 w-4 mr-2 text-indigo-400" />
            Consult Copilot
          </Button>
        </div>
      </div>

      {scoreDetails && (
        <div className="space-y-8">
          {/* Main Top row: Trust Card Card */}
          <motion.div variants={itemVariants} className="w-full">
            <TrustScoreCard 
              scoreDetails={scoreDetails} 
              onRefresh={() => fetchScoreMetric(true)} 
              isRefreshing={isRefreshing}
            />
          </motion.div>

          {/* Breakdown Rows */}
          <motion.div variants={itemVariants} className="w-full">
            <TrustScoreBreakdown scoreDetails={scoreDetails} />
          </motion.div>

          {/* Graphs and Benchmark Comparison Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div variants={itemVariants} className="w-full">
              <TrustScoreHistory scoreDetails={scoreDetails} />
            </motion.div>
            <motion.div variants={itemVariants} className="w-full">
              <TrustScoreTrend scoreDetails={scoreDetails} />
            </motion.div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
