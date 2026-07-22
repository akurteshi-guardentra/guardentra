import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ClipboardCheck, 
  Zap, 
  ArrowRight, 
  Loader2, 
  FileText, 
  Flame,
  Search,
  RefreshCw,
  BarChart3,
  Scale
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';
import ReactMarkdown from 'react-markdown';

interface AuditAssessment {
  id: string;
  framework: string;
  readinessScore: number;
  status: 'Ready' | 'Near Ready' | 'Not Ready';
  redFlags: string[];
  recommendations: string[];
  auditorOpinion: string;
  createdAt: string;
}

export function AuditReadiness() {
  const { profile, loading } = useAuth();
  const [assessments, setAssessments] = useState<AuditAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AuditAssessment | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'audit_readiness'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: AuditAssessment[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as AuditAssessment);
      });
      // Sort in JS to avoid index requirement
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAssessments(data);
      if (data.length > 0 && !selectedAudit) setSelectedAudit(data[0]);
      setIsLoading(false);
    }, (error) => {
      console.error("Audit Readiness loading error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const runAuditScan = async (framework: string = 'NYDFS Part 500') => {
    if (!profile?.organizationId) return;
    setIsScanning(true);

    try {
      // 1. Gather context from other collections
      const [risksSnap, policiesSnap, incidentsSnap, connectorsSnap, vendorsSnap] = await Promise.all([
        getDocs(query(collection(db, 'risks'), where('organizationId', '==', profile.organizationId))),
        getDocs(query(collection(db, 'policies'), where('organizationId', '==', profile.organizationId), where('status', '==', 'Active'))),
        getDocs(query(collection(db, 'incidents'), where('organizationId', '==', profile.organizationId), where('status', '!=', 'Resolved'))),
        getDocs(query(collection(db, 'connectors'), where('organizationId', '==', profile.organizationId))),
        getDocs(query(collection(db, 'vendors'), where('organizationId', '==', profile.organizationId)))
      ]);

      const context = {
        risks: risksSnap.docs.map(d => d.data()),
        activePolicies: policiesSnap.docs.map(d => d.data().title),
        openIncidents: incidentsSnap.size,
        connectors: connectorsSnap.docs.map(d => ({ type: d.data().type, health: d.data().health })),
        vendors: vendorsSnap.docs.map(d => ({ name: d.data().name, criticality: d.data().criticality }))
      };

      // 2. Call Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Act as a cynical and strict regulatory auditor specializing in Insurance (NYDFS Part 500 and NAIC). 
      Analyze the following organizational data for audit readiness against the ${framework} framework:
      - Risks: ${JSON.stringify(context.risks)}
      - Active Policies: ${JSON.stringify(context.activePolicies)}
      - Open Incidents: ${context.openIncidents}
      - Infrastructure Health: ${JSON.stringify(context.connectors)}
      - Third-Party Landscape: ${JSON.stringify(context.vendors)}
      
      Requirements for ${framework}:
      - Multi-Factor Authentication (MFA) enforcement
      - Asset Management & Data Residency
      - Third-Party Risk Management (TPRM)
      - Incident Reporting (72-hour windows)
      
      Return a JSON assessment including:
      - readinessScore (0-100)
      - status ("Ready", "Near Ready", "Not Ready")
      - redFlags (Array of strings, specifically what will cause a qualification or failure)
      - recommendations (Array of strings, specific actions to fix red flags)
      - auditorOpinion (A professional auditor's summary, blunt and direct focus on regulatory impact)
      
      Be thorough. Specifically point out if Third-Party Risk Management or Incident Plans are missing.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              readinessScore: { type: Type.NUMBER },
              status: { type: Type.STRING },
              redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              auditorOpinion: { type: Type.STRING }
            },
            required: ["readinessScore", "status", "redFlags", "recommendations", "auditorOpinion"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      await addDoc(collection(db, 'audit_readiness'), {
        ...result,
        framework,
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });

    } catch (error) {
      console.error("Audit scan failed:", error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 animate-in fade-in duration-700">
      {/* List Sidebar */}
      <div className="w-80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight font-display">Audit Lab</h1>
          <Button 
            size="sm" 
            onClick={() => runAuditScan()} 
            disabled={isScanning}
            className="rounded-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
          >
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl bg-white/5">
              <Scale className="h-8 w-8 mx-auto text-slate-700 mb-2" />
              <p className="text-xs text-slate-500 max-w-[180px] mx-auto">No assessments found. Start your first AI-driven readiness scan.</p>
            </div>
          ) : (
            assessments.map((audit) => (
              <button
                key={audit.id}
                onClick={() => setSelectedAudit(audit)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden group",
                  selectedAudit?.id === audit.id 
                    ? "bg-white/10 border-white/10 shadow-xl" 
                    : "bg-white/5 border-white/5 hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{audit.framework}</span>
                  <span className={cn(
                    "text-[10px] font-mono",
                    audit.readinessScore > 80 ? "text-emerald-400" : audit.readinessScore > 50 ? "text-amber-400" : "text-rose-400"
                  )}>
                    {audit.readinessScore}%
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{new Date(audit.createdAt).toLocaleDateString()} Assessment</h3>
                <p className="text-[10px] text-slate-500 font-mono">
                  Status: <span className={cn(
                    audit.status === 'Ready' ? "text-emerald-400" : "text-amber-400"
                  )}>{audit.status}</span>
                </p>
                {selectedAudit?.id === audit.id && (
                  <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Report View */}
      <div className="flex-1 glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {selectedAudit ? (
            <motion.div 
              key={selectedAudit.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Report Header */}
              <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold text-white">{selectedAudit.framework} Readiness Report</h2>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10",
                      selectedAudit.status === 'Ready' ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"
                    )}>
                      {selectedAudit.status}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">Generated on {new Date(selectedAudit.createdAt).toLocaleString()} by Guardentra AI Auditor</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Readiness Score</p>
                    <p className={cn(
                      "text-4xl font-bold font-mono",
                      selectedAudit.readinessScore > 80 ? "text-emerald-400" : "text-rose-400"
                    )}>{selectedAudit.readinessScore}%</p>
                  </div>
                </div>
              </div>

              {/* Report Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                  
                  {/* Auditor's Opinion */}
                  <div className="lg:col-span-2 p-6 rounded-2xl bg-white/5 border border-white/5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-primary" />
                      Official Auditor Opinion
                    </h3>
                    <div className="prose prose-invert prose-sm max-w-none italic text-slate-300 leading-relaxed">
                      <ReactMarkdown>{selectedAudit.auditorOpinion}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Red Flags */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2">
                      <Flame className="h-4 w-4" />
                      Audit Red Flags (High Priority)
                    </h3>
                    <div className="space-y-4">
                      {selectedAudit.redFlags.map((flag, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
                          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                          <p className="text-sm text-slate-300">{flag}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Remediation Plan */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Remediation Checklist
                    </h3>
                    <div className="space-y-4">
                      {selectedAudit.recommendations.map((rec, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          <p className="text-sm text-slate-300">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-12 text-center">
              <ShieldCheck className="h-16 w-16 mb-6 opacity-20 text-slate-700" />
              <h2 className="text-xl font-bold text-white mb-2">Audit Readiness Lab</h2>
              <p className="max-w-xs mx-auto mb-8 text-sm">Guardentra AI Auditor will mock an actual audit and tell you exactly where you'll fail before the real auditors arrive.</p>
              <Button onClick={() => runAuditScan()} disabled={isScanning} className="bg-primary hover:bg-primary/90 text-white min-w-[200px]">
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Metadata...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Start Readiness Scan
                  </>
                )}
              </Button>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
