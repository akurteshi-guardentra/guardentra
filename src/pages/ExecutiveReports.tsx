import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  FileText, 
  Crown, 
  TrendingUp, 
  Shield, 
  Plus, 
  Loader2, 
  Download, 
  BarChart4, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';

interface ExecutiveReport {
  id: string;
  title: string;
  summary: string;
  keyMetrics: {
    riskCoverage: number;
    complianceHealth: number;
    incidentResolutionRate: number;
    vendorRiskLevel: string;
  };
  strategicOutlook: string;
  actionItems: string[];
  organizationId: string;
  createdAt: string;
}

export function ExecutiveReports() {
  const { profile, loading } = useAuth();
  const [reports, setReports] = useState<ExecutiveReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ExecutiveReport | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'executive_reports'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: ExecutiveReport[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as ExecutiveReport);
      });
      // Sort in JS
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(data);
      if (data.length > 0 && !selectedReport) {
        setSelectedReport(data[0]);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Executive reports loading error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const generateReport = async () => {
    if (!profile?.organizationId) return;
    setIsGenerating(true);

    try {
      // 1. Gather context from all collections
      const risksSnap = await getDocs(query(collection(db, 'risks'), where('organizationId', '==', profile.organizationId)));
      const complianceSnap = await getDocs(query(collection(db, 'compliance'), where('organizationId', '==', profile.organizationId)));
      const incidentsSnap = await getDocs(query(collection(db, 'incidents'), where('organizationId', '==', profile.organizationId)));
      const vendorsSnap = await getDocs(query(collection(db, 'vendors'), where('organizationId', '==', profile.organizationId)));

      const context = {
        risksCount: risksSnap.size,
        criticalRisks: risksSnap.docs.filter(d => d.data().severity === 'Critical').map(d => d.data().title),
        riskSeverity: risksSnap.docs.map(d => d.data().severity),
        complianceStatus: complianceSnap.docs.map(d => ({ name: d.data().name, progress: d.data().progress, gaps: d.data().gapAnalysis?.evidence_gaps || [] })),
        incidentsCount: incidentsSnap.size,
        vendorsCount: vendorsSnap.size,
        vendorCriticality: vendorsSnap.docs.map(d => d.data().criticality)
      };

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Act as an elite Chief Information Security Officer (CISO). 
      Generate a data-driven Security & Risk Posture Report for the Board of Directors.
      
      Organizational Context:
      - Critical Risks Identified: ${context.criticalRisks.join(', ') || 'None'}
      - Total Risk Register size: ${context.risksCount}
      - Compliance Frameworks progress: ${JSON.stringify(context.complianceStatus)}
      - Active Security Incidents: ${context.incidentsCount}
      - Third-party Supply Chain surface: ${context.vendorsCount} vendors
      
      Return a JSON object:
      {
        "title": "Quarterly Security Governance & Risk Exposure Report",
        "summary": "Authoritative summary of our current defensive posture and residual risk.",
        "keyMetrics": { 
          "riskCoverage": number (0-100), 
          "complianceHealth": number (0-100), 
          "incidentResolutionRate": number (0-100), 
          "vendorRiskLevel": "Low" | "Medium" | "High" 
        },
        "strategicOutlook": "Detailed strategic outlook focusing on resource allocation and emerging threats.",
        "actionItems": ["Strategic Priority 1", "Strategic Priority 2", "Strategic Priority 3"] 
      }`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const reportData = JSON.parse(result.text || "{}");
      
      await addDoc(collection(db, 'executive_reports'), {
        ...reportData,
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });

    } catch (error) {
      console.error("Failed to generate report:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display flex items-center gap-4">
            <Crown className="h-10 w-10 text-primary" />
            Executive Reporting Suite
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            AI-synthesized security briefings for the Board and C-Suite.
          </p>
        </div>
        <Button 
          onClick={generateReport}
          disabled={isGenerating}
          className="bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 px-8 py-6 text-lg h-auto"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-6 w-6 mr-3 animate-spin" />
              Synthesizing Quarterly Report...
            </>
          ) : (
            <>
              <Sparkles className="h-6 w-6 mr-3" />
              Generate Executive Briefing
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar: Report History */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl h-[calc(100vh-250px)] flex flex-col">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Report Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-2 space-y-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" />
                  <p className="text-xs">Accessing archives...</p>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic text-sm">
                  No reports generated yet.
                </div>
              ) : (
                reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl transition-all border group",
                      selectedReport?.id === report.id 
                        ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/5" 
                        : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-xs font-bold font-mono tracking-tighter uppercase p-1 px-2 rounded",
                        selectedReport?.id === report.id ? "bg-primary text-white" : "bg-white/10 text-slate-400"
                      )}>
                        {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform",
                        selectedReport?.id === report.id ? "translate-x-0 text-primary" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                      )} />
                    </div>
                    <p className="font-semibold text-white truncate">{report.title}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-mono">
                      Metric Coverage: {report.keyMetrics.complianceHealth}%
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Report View */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {selectedReport ? (
              <motion.div
                key={selectedReport.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Header Section */}
                <div className="glass-panel p-8 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none" />
                  
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] uppercase tracking-widest">Confidential</Badge>
                        <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] uppercase tracking-widest">Internal Audit Ref: {selectedReport.id.substring(0, 6)}</Badge>
                      </div>
                      <h2 className="text-3xl font-bold text-white font-display uppercase tracking-tight">{selectedReport.title}</h2>
                      <p className="text-slate-400 font-mono text-sm">
                        Compiled on {new Date(selectedReport.createdAt).toLocaleString()} by Guardentra AI Governance Engine
                      </p>
                    </div>
                    <Button variant="outline" className="border-white/10 text-slate-400 hover:bg-white/5">
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Risk Coverage', value: `${selectedReport.keyMetrics.riskCoverage}%`, icon: TrendingUp, color: 'text-orange-400' },
                    { label: 'Compliance Health', value: `${selectedReport.keyMetrics.complianceHealth}%`, icon: Shield, color: 'text-emerald-400' },
                    { label: 'Incident Resolution', value: `${selectedReport.keyMetrics.incidentResolutionRate}%`, icon: BarChart4, color: 'text-blue-400' },
                    { label: 'Vendor Risk', value: selectedReport.keyMetrics.vendorRiskLevel, icon: Shield, color: 'text-rose-400' },
                  ].map((metric, i) => (
                    <Card key={i} className="bg-white/5 border-white/5 overflow-hidden group">
                      <div className="p-4 flex flex-col items-center text-center">
                        <metric.icon className={cn("h-6 w-6 mb-2 opacity-50 transition-opacity group-hover:opacity-100", metric.color)} />
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{metric.label}</p>
                        <p className={cn("text-xl font-bold font-mono", metric.color)}>{metric.value}</p>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Report Body */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <Card className="bg-white/5 border-white/5 h-full">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-200">Executive Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-400 leading-relaxed text-sm italic font-serif">
                          "{selectedReport.summary}"
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="space-y-6">
                    <Card className="bg-white/5 border-white/5 h-full">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-200">Forward Outlook</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-400 leading-relaxed text-sm">
                          {selectedReport.strategicOutlook}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Strategic Priorities */}
                <Card className="bg-primary/5 border-primary/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <TrendingUp className="h-32 w-32" />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      Critical Deployment Initiatives
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedReport.actionItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 rounded-xl bg-black/20 border border-white/5 group transition-all hover:bg-black/30">
                          <div className="flex-shrink-0 mt-1">
                            {idx === 0 ? <AlertCircle className="h-5 w-5 text-rose-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                          </div>
                          <div>
                            <p className="text-slate-200 font-medium text-sm">{item}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Priority {idx + 1} • Est. Completion: Next Period</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-slate-500 space-y-4 glass-panel rounded-2xl border border-white/10">
                <FileText className="h-16 w-16 opacity-10" />
                <div className="text-center">
                  <p className="text-xl font-bold text-white/20">Archived Briefings</p>
                  <p className="text-sm">Select a report from the ledger or generate a new intelligence briefing.</p>
                </div>
                <Button variant="outline" onClick={generateReport} className="border-white/10 text-white mt-4">
                  Generate First Report
                </Button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", className)}>
      {children}
    </span>
  );
}
