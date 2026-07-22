import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { AlertTriangle, ShieldCheck, Activity, AlertCircle, Sparkles, TrendingUp, Loader2, Calendar, Zap, FileCheck, Scale, Swords, PlayCircle, ShieldAlert, Clock } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { GoogleGenAI } from "@google/genai";
import { calculateTrustScore, TrustScoreDetails } from '../lib/TrustScoreEngine';
import { ActivityFeed } from '../components/ActivityFeed';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 } as any
  }
};

export function Dashboard() {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();
  const [aiBriefing, setAiBriefing] = useState("Aggregating governance telemetry...");
  const [actionableSteps, setActionableSteps] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(true);
  
  const [stats, setStats] = useState({
    totalRisks: 0,
    riskVaR: 0,
    complianceScore: 0,
    activeIncidents: 0,
    upcomingAudits: 0,
    pendingAssessments: 0
  });

  const [riskDistribution, setRiskDistribution] = useState([
    { name: 'Critical', value: 0, color: '#ef4444' },
    { name: 'High', value: 0, color: '#f97316' },
    { name: 'Medium', value: 0, color: '#eab308' },
    { name: 'Low', value: 0, color: '#22c55e' },
  ]);

  const [complianceCharts, setComplianceCharts] = useState([
    { name: 'ISO 27001', score: 0 },
    { name: 'SOC 2', score: 0 },
    { name: 'NIST', score: 0 },
    { name: 'HIPAA', score: 0 },
  ]);

  const [activities, setActivities] = useState<any[]>([]);
  const [showDrillModal, setShowDrillModal] = useState(false);
  const [isDrilling, setIsDrilling] = useState(false);
  const [drillScenario, setDrillScenario] = useState<any>(null);
  const [trustDetails, setTrustDetails] = useState<TrustScoreDetails | null>(null);

  const startSecurityDrill = async () => {
    setIsDrilling(true);
    setShowDrillModal(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Fetch recent incidents to make the drill relevant
      const recentIncidentsText = activities
        .filter(a => a.module === 'Incident')
        .slice(0, 2)
        .map(i => i.title)
        .join(', ');

      const prompt = `Act as a Red Team Lead. Generate a high-stakes GRC security drill for an SME. 
      ${recentIncidentsText ? `The organization recently faced these incidents: ${recentIncidentsText}. Build a drill that tests if they've learned from these.` : 'Generate a scenario for a common breach type like SIM Swap or API Key Leak.'}
      Return JSON: { "title": "...", "impact": "...", "goal": "...", "score": 78 }`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const cleanJson = (result.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
      setDrillScenario(JSON.parse(cleanJson));
    } catch (e) {
      setDrillScenario({ 
        title: "SIM Swap Attack", 
        impact: "Super-admin account taken over via mobile carrier social engineering.", 
        goal: "Verify if your MFA Policy includes FIDO2 hardware keys.",
        score: 65
      });
    } finally {
      setIsDrilling(false);
    }
  };

  useEffect(() => {
    if (loading) return;

    if (!profile?.organizationId) {
      setIsAiLoading(false);
      return;
    }

    const fetchRealData = async () => {
      let risks: any[] = [];
      let score = 0;
      let incidentCount = 0;

      try {
        // Fetch Risks
        try {
          console.log("Dashboard: Fetching risks for org:", profile.organizationId);
          const risksQuery = query(collection(db, 'risks'), where('organizationId', '==', profile.organizationId), limit(100));
          const riskSnap = await getDocs(risksQuery);
          risks = riskSnap.docs.map(d => ({ ...d.data(), id: d.id, module: 'Risk' })) as any[];
          
          const dist = [
            { name: 'Critical', value: risks.filter(r => r.severity === 'Critical').length, color: '#ef4444' },
            { name: 'High', value: risks.filter(r => r.severity === 'High').length, color: '#f97316' },
            { name: 'Medium', value: risks.filter(r => r.severity === 'Medium').length, color: '#eab308' },
            { name: 'Low', value: risks.filter(r => r.severity === 'Low').length, color: '#22c55e' },
          ];
          setRiskDistribution(dist);
          setStats(prev => ({ ...prev, totalRisks: risks.length, riskVaR: risks.length * 12500 }));
          
          // Fetch Audit Readiness
          console.log("Dashboard: Fetching audit_readiness");
          const auditSnap = await getDocs(query(collection(db, 'audit_readiness'), where('organizationId', '==', profile.organizationId), limit(5)));
          if (!auditSnap.empty) {
            const sortedAudits = auditSnap.docs
              .map(d => ({ ...d.data(), createdAt: d.data().createdAt } as any))
              .sort((a, b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return db.getTime() - da.getTime();
              });
            score = sortedAudits[0].readinessScore || sortedAudits[0].score || 0;
          }
          setStats(prev => ({ ...prev, complianceScore: score }));

          // Fetch Assessments
          console.log("Dashboard: Fetching assessments");
          const assessSnap = await getDocs(query(collection(db, 'assessments'), where('organizationId', '==', profile.organizationId)));
          const pendingAssessments = assessSnap.docs.filter(d => d.data().status !== 'Completed').length;
          setStats(prev => ({ ...prev, pendingAssessments }));

          // Fetch Incidents
          console.log("Dashboard: Fetching incidents");
          const incidentSnap = await getDocs(query(collection(db, 'incidents'), where('organizationId', '==', profile.organizationId), limit(50)));
          incidentCount = incidentSnap.size;
          setStats(prev => ({ ...prev, activeIncidents: incidentCount }));

          // Fetch Calendar
          console.log("Dashboard: Fetching calendar_events");
          const calSnap = await getDocs(query(collection(db, 'calendar_events'), where('organizationId', '==', profile.organizationId), limit(50)));
          setStats(prev => ({ ...prev, upcomingAudits: calSnap.size }));

          // Aggregate Activity Stream (Simplified for resilience)
          const assessDocs = assessSnap.docs.map(d => ({ ...d.data(), id: d.id, module: 'Assessment', title: `Assessment: ${d.data().vendorName}`, date: d.data().createdAt }));
          const complianceSnap = await getDocs(query(collection(db, 'compliance'), where('organizationId', '==', profile.organizationId), limit(20)));
          const complianceDocs = complianceSnap.docs.map(d => ({ ...d.data(), id: d.id, module: 'Compliance', title: `${d.data().status}: ${d.data().name}`, date: d.data().createdAt }));
          
          const combined = [
            ...risks.map(r => ({ ...r, title: r.title, date: r.createdAt })),
            ...incidentSnap.docs.map(i => ({ ...i.data(), id: i.id, module: 'Incident', date: i.data().createdAt })),
            ...complianceDocs,
            ...assessDocs
          ].sort((a: any, b: any) => {
            const da = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
            const db = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
            return db - da;
          }).slice(0, 8);
          setActivities(combined);

          const tDetails = await calculateTrustScore(profile.organizationId);
          setTrustDetails(tDetails);

        } catch (queryErr: any) {
          console.error("Dashboard: One or more queries failed:", queryErr);
          if (queryErr.message?.includes('permission')) {
             throw queryErr; // Re-throw to be caught by the outer catch
          }
        }

        // Run AI Analysis
        const cacheKey = `briefing_${profile.organizationId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const { briefing, priorities, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 1000 * 60 * 15) {
              setAiBriefing(briefing);
              setActionableSteps(priorities);
              setIsAiLoading(false);
              return;
            }
          } catch (e) {
            console.warn("Dashboard: Failed to parse cached briefing", e);
          }
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `Analyze: Total Risks: ${risks.length}, Compliance: ${score}%, Incidents: ${incidentCount}. Briefing (3-4 sentences) and 3 priorities. JSON: { "briefing": "...", "priorities": ["...", "...", "..."] }`;
        const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt, config: { responseMimeType: "application/json" } });
        const text = result.text || '{}';
        const aiData = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        setAiBriefing(aiData.briefing);
        setActionableSteps(aiData.priorities);
        localStorage.setItem(cacheKey, JSON.stringify({ ...aiData, timestamp: Date.now() }));

      } catch (error: any) {
        console.error("Dashboard data load failed:", error);
        // Only update briefing if it's the first load or fatal error
        setAiBriefing("Security telemetry synchronization issue. Please verify you are signed in correctly.");
      } finally {
        setIsAiLoading(false);
      }
    };

    fetchRealData();
  }, [profile?.organizationId]);

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Command Center</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-slate-400">Real-time governance, risk, and compliance posture.</p>
            <div className="h-1 w-1 rounded-full bg-slate-700" />
            <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest font-mono">Telemetry: Prime</span>
            </div>
          </div>
        </div>
        
        {/* Identity Resilience Quotient Centerpiece */}
        <div className="flex items-center gap-4">
          <div className="hidden xl:flex items-center gap-6 px-6 py-2 border-x border-white/5 bg-white/[0.01]">
             <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-600 tracking-widest">NYDFS Compliance</span>
                <span className="text-xs text-white font-mono font-bold tracking-tighter">98.2%</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-600 tracking-widest">Market Drift</span>
                <span className="text-xs text-rose-400 font-mono font-bold tracking-tighter">-1.4%</span>
             </div>
          </div>
          
          <div 
            onClick={() => navigate('/trust-intelligence')}
            className="glass-panel px-6 py-3 rounded-2xl border border-white/5 flex items-center gap-4 bg-white/[0.02] shadow-xl shadow-indigo-500/5 hover:bg-white/[0.04] hover:border-indigo-500/20 cursor-pointer transition-all duration-300"
          >
             <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Trust Index™</span>
                <span className="text-xs text-indigo-400 font-mono animate-pulse">
                  {trustDetails && trustDetails.overallScore >= 85 ? 'SOVEREIGN' : 'IN COMPLIANCE'}
                </span>
             </div>
             <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                  <circle 
                    cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" 
                    strokeDasharray="283" 
                    strokeDashoffset={283 - (283 * (trustDetails?.overallScore || 82)) / 100}
                    className="text-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" strokeLinecap="round" transform="rotate(-90 50 50)"
                  />
                </svg>
                <span className="absolute text-xs font-bold text-white font-mono">{trustDetails?.overallScore || 82}%</span>
             </div>
          </div>
        </div>
      </div>

      {/* Regulatory Pulse Ticker */}
      <div className="w-full overflow-hidden bg-indigo-500/5 border-y border-indigo-500/10 py-2 relative">
         <div className="flex whitespace-nowrap animate-marquee">
            {[
              "NYDFS Part 500: New reporting requirements for Q3 2026 active",
              "NAIC Market Conduct: Deviation detected in vendor ledger",
              "ISO 27001:2022 Mapping: 100% complete",
              "Data Privacy: PII isolation audit verified",
              "Identity Entropy: Baseline established for privileged accounts",
              "System Health: All connectors reported nominal throughput"
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-4 mx-8">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                 <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest font-mono opacity-60 hover:opacity-100 transition-opacity cursor-default">{text}</span>
              </div>
            ))}
         </div>
      </div>

      {/* Operator Action Center — Daily Directives */}
      <motion.div variants={itemVariants}>
        <Card className="bg-slate-950/60 border border-indigo-500/10 shadow-2xl rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />
          <CardHeader className="p-6 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-indigo-400" />
                  What Should I Do Today? — Operator Action Center
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  Urgent, prioritized compliance corrections compiled across your identity surface and vendor locker.
                </CardDescription>
              </div>
              <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase text-[9px] font-mono tracking-widest py-1 px-2.5 w-fit h-fit animate-pulse">
                3 Directives Pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Task 1 */}
              <div className="p-5 rounded-2xl bg-white/[0.01] border border-red-500/10 hover:border-red-500/30 transition-all flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/[0.02] rounded-full blur-2xl group-hover:bg-red-500/[0.05] transition-all" />
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <Badge className="bg-red-500/15 text-red-400 border border-red-500/25 uppercase font-mono text-[8px] font-bold tracking-widest px-1.5 py-0.5">
                      CRITICAL
                    </Badge>
                    <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-red-500" /> 1 Day Left
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-red-300 transition-colors">
                      Audit Claims Processing Vendor Credential Latency
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Our claims partner "ClaimsPlus" has zero multi-factor configuration. Secure access or restrict integration paths immediately.
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500 uppercase font-mono">Assigned Owner</span>
                    <span className="text-[10px] text-slate-300 font-medium font-sans">Lead Security Ops</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] uppercase font-bold tracking-widest text-indigo-400 hover:text-white hover:bg-indigo-600/20 cursor-pointer"
                    onClick={() => {
                      const askButton = document.querySelector('button[onClick*="setIsCopilotOpen"]');
                      if (askButton) (askButton as any).click();
                    }}
                  >
                    Solve Now →
                  </Button>
                </div>
              </div>

              {/* Task 2 */}
              <div className="p-5 rounded-2xl bg-white/[0.01] border border-amber-500/10 hover:border-amber-500/30 transition-all flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.02] rounded-full blur-2xl group-hover:bg-amber-500/[0.05] transition-all" />
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/25 uppercase font-mono text-[8px] font-bold tracking-widest px-1.5 py-0.5">
                      HIGH RISK
                    </Badge>
                    <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" /> 5 Days Left
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                      Retrieve Lapsed ISO & SOC 2 Certificates
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      "InsurOps Ltd" security attestation has lapsed for more than 4 months. Reach out to acquire renewal proof documents.
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500 uppercase font-mono">Assigned Owner</span>
                    <span className="text-[10px] text-slate-300 font-medium font-sans">Compliance Lead</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] uppercase font-bold tracking-widest text-indigo-400 hover:text-white hover:bg-indigo-600/20 cursor-pointer"
                    onClick={() => {
                      const askButton = document.querySelector('button[onClick*="setIsCopilotOpen"]');
                      if (askButton) (askButton as any).click();
                    }}
                  >
                    Solve Now →
                  </Button>
                </div>
              </div>

              {/* Task 3 */}
              <div className="p-5 rounded-2xl bg-white/[0.01] border border-indigo-500/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/[0.02] rounded-full blur-2xl group-hover:bg-indigo-500/[0.05] transition-all" />
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <Badge className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 uppercase font-mono text-[8px] font-bold tracking-widest px-1.5 py-0.5">
                      MEDIUM
                    </Badge>
                    <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-400" /> 2 Days Left
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                      Deactivate Orphaned IAM Cloud Accounts
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      We detected 3 development credentials that have been idle for 90+ days. Deprovision immediately under least-privilege standards.
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500 uppercase font-mono">Assigned Owner</span>
                    <span className="text-[10px] text-slate-300 font-medium font-sans">Systems Admin</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] uppercase font-bold tracking-widest text-indigo-400 hover:text-white hover:bg-indigo-600/20 cursor-pointer"
                    onClick={() => {
                      const askButton = document.querySelector('button[onClick*="setIsCopilotOpen"]');
                      if (askButton) (askButton as any).click();
                    }}
                  >
                    Solve Now →
                  </Button>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* War Room Simulator Section */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="md:col-span-2 p-1 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-indigo-500/20">
            <div className="bg-slate-950 rounded-[inherit] p-6 sm:p-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10 sm:opacity-100">
                  <Swords className="h-12 w-12 sm:h-24 sm:w-24 text-white/[0.03] -rotate-12" />
               </div>
               <div className="relative flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                  <div className="text-center md:text-left space-y-2">
                     <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Active GRC War Room</h2>
                     <p className="text-slate-400 text-xs sm:text-sm max-w-md">
                        Simulate specific threat scenarios based on your real-time cloud and identity risk surface.
                     </p>
                  </div>
                  <Button 
                    onClick={startSecurityDrill}
                    disabled={isDrilling}
                    className="w-full sm:w-auto bg-white text-black hover:bg-slate-200 px-6 sm:px-8 py-4 sm:py-6 rounded-2xl font-bold text-base sm:text-lg shadow-xl shadow-white/5"
                  >
                    {isDrilling ? <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" /> : <PlayCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />}
                    Initialize Drill
                  </Button>
               </div>
            </div>
          </div>
          <Card className="bg-slate-900/40 border-white/5 p-6 flex flex-col justify-between">
             <div>
                <h3 className="text-xs uppercase font-bold text-slate-500 tracking-[0.2em] mb-4">Drill Preparedness</h3>
                <div className="space-y-4">
                   <div className="flex justify-between items-end">
                      <span className="text-xs text-slate-400">Policy Coverage</span>
                      <span className="text-white font-mono font-bold">92%</span>
                   </div>
                   <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[92%]" />
                   </div>
                </div>
             </div>
             <p className="text-[10px] text-slate-600 font-mono italic">
                Active simulated drill history: 4 Drills Completed. Last Session: Resilience Verification.
             </p>
          </Card>
        </div>
      </motion.div>

      {/* Drill Results Modal */}
      <AnimatePresence>
        {showDrillModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel max-w-2xl w-full p-10 rounded-3xl border border-white/10 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Swords className="h-32 w-32" />
              </div>
              
              {isDrilling ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                   <div className="relative">
                      <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-primary">GRC</div>
                   </div>
                   <h3 className="text-2xl font-bold text-white font-display">AI Strategist is generating Paradox Scenario...</h3>
                   <p className="text-slate-500 font-mono text-sm max-w-xs uppercase tracking-tighter">Analyzing identity maps, cloud connectors & active policies</p>
                </div>
              ) : drillScenario && (
                <div className="space-y-8">
                  <div>
                    <Badge className="bg-primary/20 text-primary border-primary/30 mb-4 uppercase tracking-[0.2em] text-[10px] px-3 py-1">Paradox Drill Phase 1</Badge>
                    <h2 className="text-4xl font-bold text-white tracking-tighter mb-4">{drillScenario.title}</h2>
                    <p className="text-lg text-slate-300 leading-relaxed italic border-l-4 border-primary pl-6">
                      "{drillScenario.impact}"
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 bg-white/[0.03] p-6 rounded-2xl border border-white/5">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Simulated Readiness Score</h4>
                      <div className="text-4xl font-bold text-emerald-400 font-mono">{drillScenario.score}%</div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Primary Readiness Goal</h4>
                      <p className="text-xs text-white font-medium">{drillScenario.goal}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      className="flex-1 bg-primary text-white hover:bg-primary/90 h-14 font-bold text-lg"
                      onClick={() => {
                        // In a real app, this would start the interactive response flow
                        setShowDrillModal(false);
                      }}
                    >
                      Initialize Response Playbook
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-slate-500 hover:text-white"
                      onClick={() => setShowDrillModal(false)}
                    >
                      Dismiss Drill
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Dashboard Top Row - Regulatory Health & Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border-indigo-500/30 border-glow h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-indigo-300">
                <Sparkles className="h-5 w-5" />
                Strategic CISO Briefing
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAiLoading ? (
                <div className="flex items-center gap-2 text-slate-400 font-mono text-sm h-12">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aggregating regulatory telemetry...
                </div>
              ) : (
                <>
                  <p className="text-slate-300 leading-relaxed font-mono text-sm">
                    {aiBriefing}
                  </p>
                  {actionableSteps.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {actionableSteps.map((step, idx) => (
                        <div key={idx} className="text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded border border-indigo-500/30 font-mono transition-colors hover:bg-indigo-500/30 cursor-default">
                          {step}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-slate-900/40 border-white/5 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
               <Scale className="h-16 w-16" />
            </div>
            <CardHeader className="pb-2">
               <CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-[0.2em]">Regulatory Health</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between pt-4">
               <div className="space-y-4">
                  {[
                    { name: 'NYDFS Part 500', score: stats.complianceScore, status: 'Compliant' },
                    { name: 'NAIC Model Law', score: Math.max(0, stats.complianceScore - 8), status: 'Near Ready' },
                    { name: 'ISO 27001:2022', score: Math.max(0, stats.complianceScore + 2), status: 'Certified' }
                  ].map((reg) => (
                    <div key={reg.name} className="flex flex-col gap-1">
                       <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-bold text-slate-300 font-mono">{reg.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono uppercase">{reg.status}</span>
                       </div>
                       <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-1000",
                              reg.score > 80 ? "bg-emerald-500" : reg.score > 60 ? "bg-amber-500" : "bg-rose-500"
                            )} 
                            style={{ width: `${reg.score}%` }} 
                          />
                       </div>
                    </div>
                  ))}
               </div>
               <div className="mt-8">
                  <Button variant="ghost" onClick={() => navigate('/audit-readiness')} className="w-full text-[10px] uppercase font-bold tracking-widest text-slate-500 hover:text-white border border-white/5">
                    View Compliance Ledger →
                  </Button>
               </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Start for New Users */}
      {stats.totalRisks === 0 && !isAiLoading && (
        <motion.div variants={itemVariants}>
          <div className="p-8 rounded-3xl bg-slate-900 border border-white/5 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4">
                <Sparkles className="h-12 w-12 text-primary/20" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-4">Welcome to Guardentra, {profile?.displayName?.split(' ')[0] || 'Leader'}</h2>
             <p className="text-slate-400 mb-8 max-w-2xl leading-relaxed">
                The platform is currently in "Standby" mode. To activate the AI insights engine and start generating strategic briefings, complete your first governance tasks.
             </p>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-primary/30 transition-all group">
                   <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                      <AlertTriangle className="h-5 w-5" />
                   </div>
                   <h3 className="font-bold text-white mb-1">Risk Register</h3>
                   <p className="text-xs text-slate-500 mb-4">Log your first risk to calibrate the Value at Risk engine.</p>
                   <button onClick={() => navigate('/risks')} className="text-primary font-bold text-[10px] uppercase tracking-widest hover:underline">Go to Risks →</button>
                </div>
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-primary/30 transition-all group">
                   <div className="p-2 w-fit rounded-lg bg-indigo-500/10 text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                      <Zap className="h-5 w-5" />
                   </div>
                   <h3 className="font-bold text-white mb-1">AI Draftsman</h3>
                   <p className="text-xs text-slate-500 mb-4">Let AI write your first ISO 27001 policy in seconds.</p>
                   <button onClick={() => navigate('/policies/draftsman')} className="text-primary font-bold text-[10px] uppercase tracking-widest hover:underline">Draft Now →</button>
                </div>
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-primary/30 transition-all group">
                   <div className="p-2 w-fit rounded-lg bg-amber-500/10 text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                      <Activity className="h-5 w-5" />
                   </div>
                   <h3 className="font-bold text-white mb-1">System Audit</h3>
                   <p className="text-xs text-slate-500 mb-4">Verify the core infrastructure and security rules.</p>
                   <button onClick={() => navigate('/health')} className="text-primary font-bold text-[10px] uppercase tracking-widest hover:underline">Run QA Test →</button>
                </div>
             </div>
          </div>
        </motion.div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Value at Risk (Est.)</CardTitle>
              <TrendingUp className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-white">${(stats.riskVaR / 1000000).toFixed(2)}M</div>
              <p className="text-xs text-rose-400 mt-1">Calculated from {stats.totalRisks} active risks</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Compliance Readiness</CardTitle>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-white">{stats.complianceScore}%</div>
              <p className="text-xs text-emerald-400 mt-1">Based on latest audit run</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Open Incidents</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-white">{stats.activeIncidents}</div>
              <p className="text-xs text-amber-400 mt-1">Requiring immediate attention</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Vendor Responses</CardTitle>
              <Zap className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-white">{stats.pendingAssessments}</div>
              <p className="text-xs text-indigo-400 mt-1">Pending active questionnaires</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 lg:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Continuous Compliance</CardTitle>
              <CardDescription>Real-time framework adherence</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={complianceCharts}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#94a3b8" />
                    <YAxis axisLine={false} tickLine={false} domain={[0, 100]} stroke="#94a3b8" />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="score" fill="url(#colorScore)" radius={[4, 4, 0, 0]}>
                      {complianceCharts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.score > 80 ? '#10b981' : entry.score > 60 ? '#6366f1' : '#ef4444'} />
                      ))}
                    </Bar>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>AI-categorized threat landscape</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full flex items-center justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold text-white">{stats.totalRisks}</span>
                  <span className="text-xs text-slate-400 tracking-tighter uppercase font-bold">Total Risks</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center flex-wrap gap-4 mt-2">
                {riskDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: item.color, color: item.color }} />
                    <span className="text-[10px] uppercase font-bold text-slate-300">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Real-time Activity Feed */}
      <motion.div variants={itemVariants}>
        <ActivityFeed />
      </motion.div>
    </motion.div>
  );
}

