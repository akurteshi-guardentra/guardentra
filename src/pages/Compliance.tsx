import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { FileText, CheckCircle2, XCircle, Clock, Sparkles, Loader2, AlertTriangle, ChevronRight, ShieldCheck, Plus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from '@/src/lib/utils';
import { Input } from '@/src/components/ui/input';

interface Framework {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: string;
  nextAudit: string;
  gapAnalysis?: any;
  isLibraryItem?: boolean;
}

const PREBUILT_FRAMEWORKS = [
  { name: 'NYDFS Part 500', description: 'New York Cybersecurity Regulation for Financial Services (Insurance Focus)', progress: 0, status: 'Not Started' },
  { name: 'NAIC Model Law 668', description: 'Data Security Model Law for Insurance Carriers and Producers', progress: 0, status: 'Not Started' },
  { name: 'ISO/IEC 27001:2022', description: 'International standard for Information Security Management Systems', progress: 0, status: 'Not Started' },
  { name: 'SOC 2 Type II', description: 'Reporting on controls for Security, Availability, and Confidentiality', progress: 0, status: 'Not Started' },
  { name: 'Solvency II (Security)', description: 'Operational Risk and Governance for EU/UK Insurance entities', progress: 0, status: 'Not Started' },
  { name: 'NIST CSF 2.0', description: 'US National Institute of Standards Cybersecurity Framework', progress: 0, status: 'Not Started' },
  { name: 'GDPR (Article 32)', description: 'Security of and Privacy for EU Data Subject Processing', progress: 0, status: 'Not Started' },
  { name: 'DORA', description: 'Digital Operational Resilience Act for EU Financial Entities', progress: 0, status: 'Not Started' },
  { name: 'CCPA / CPRA', description: 'California Privacy Rights for Consumer PII Protection', progress: 0, status: 'Not Started' },
  { name: 'ESG Scorecard', description: 'Governance and Environmental Reporting for Institutional Compliance', progress: 0, status: 'Not Started' },
];

export function Compliance() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isBuilding, setIsBuilding] = useState<string | null>(null);
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    
    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'compliance'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const frameworksData: Framework[] = [];
      snapshot.forEach((doc) => {
        frameworksData.push({ id: doc.id, ...doc.data() } as Framework);
      });
      
      setFrameworks(frameworksData);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const handleRunGapAnalysis = async (framework: Framework) => {
    setIsAnalyzing(framework.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Perform a predictive gap analysis for the ${framework.name} framework. 
                  Current Progress: ${framework.progress}%. 
                  Status: ${framework.status}.
                  Identify potential audit risks, missing evidence types, and recommended actions.
                  Return JSON: { predicted_audit_risk, evidence_gaps[], recommended_actions[{action, owner_role, effort}] }`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const analysis = JSON.parse(result.text || "{}");
      await updateDoc(doc(db, 'compliance', framework.id), {
        gapAnalysis: analysis
      });
    } catch (error) {
      console.error("Gap Analysis Error:", error);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleAddFromLibrary = async (base: any) => {
    if (!profile?.organizationId) return;
    setIsBuilding(base.name);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Act as a GRC Expert. For the compliance framework "${base.name}", provide a high-level implementation roadmap.
      Return a JSON object with: { description, initialTaskCount, keyControls[], suggestedQuestionnaire }.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const aiResponse = JSON.parse((result.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim());

      await addDoc(collection(db, 'compliance'), {
        ...base,
        description: aiResponse.description || base.description,
        progress: 0,
        status: 'In Progress',
        nextAudit: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        organizationId: profile.organizationId,
        isLibraryItem: true,
        aiMetadata: aiResponse,
        createdAt: new Date().toISOString()
      });
      
      setShowLibrary(false);
    } catch (error) {
      console.error("Failed to add from library:", error);
    } finally {
      setIsBuilding(null);
    }
  };

  const handleAddFramework = async () => {
    if (!profile?.organizationId) return;
    try {
      await addDoc(collection(db, 'compliance'), {
        name: 'New Framework',
        description: 'Custom compliance standard',
        progress: 0,
        status: 'In Progress',
        nextAudit: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to add framework:", error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Continuous Compliance</h1>
          <p className="text-sm text-slate-400 mt-1">AI-driven framework mapping and audit readiness logic.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => setShowLibrary(!showLibrary)}>
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            Framework Library
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleAddFramework}>
            <Plus className="mr-2 h-4 w-4" />
            Custom
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showLibrary && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-primary/20 bg-primary/5 backdrop-blur-md mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    AI Framework Library
                  </CardTitle>
                  <CardDescription className="text-slate-400">Select a framework to automatically build control mappings and questionnaires.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowLibrary(false)} className="text-slate-500">Close</Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PREBUILT_FRAMEWORKS.map((base) => {
                    const isInstalled = frameworks.some(f => f.name === base.name);
                    return (
                      <div key={base.name} className="p-4 rounded-xl bg-black/20 border border-white/5 flex flex-col justify-between group hover:border-primary/30 transition-all">
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">{base.name}</h4>
                          <p className="text-[10px] text-slate-500 line-clamp-2">{base.description}</p>
                        </div>
                        <Button 
                          size="sm" 
                          className={cn("mt-4 text-xs h-8", isInstalled ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-white/5 border-white/10 text-slate-300")}
                          variant="outline"
                          disabled={isInstalled || isBuilding === base.name}
                          onClick={() => handleAddFromLibrary(base)}
                        >
                          {isBuilding === base.name ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : isInstalled ? <CheckCircle2 className="h-3 w-3 mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                          {isInstalled ? "Activated" : "Activate"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Synchronizing compliance frameworks...</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {frameworks.map((framework, index) => (
            <motion.div 
              key={framework.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full border-white/10 bg-slate-900/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg text-white">{framework.name}</CardTitle>
                      <CardDescription className="text-slate-400">{framework.description}</CardDescription>
                    </div>
                    <Badge 
                      variant="outline"
                      className={cn(
                        "px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                        framework.status === 'Compliant' || framework.status === 'Active' 
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_8px_-2px_theme(colors.emerald.500)]' : 
                        framework.status === 'In Progress' || framework.status === 'Activated'
                          ? 'border-blue-500/30 text-blue-400 bg-blue-500/10 shadow-[0_0_8px_-2px_theme(colors.blue.500)]' : 
                        framework.status === 'Needs Attention' || framework.status === 'Gap Identified'
                          ? 'border-amber-500/30 text-amber-400 bg-amber-500/10 shadow-[0_0_8px_-2px_theme(colors.amber.500)]' :
                        framework.status === 'Not Started'
                          ? 'border-slate-500/30 text-slate-400 bg-slate-500/10' :
                          'border-slate-500/30 text-slate-400 bg-slate-500/10'
                      )}
                    >
                      {framework.status === 'Compliant' ? <CheckCircle2 className="h-3 w-3" /> : 
                       framework.status === 'In Progress' ? <Clock className="h-3 w-3" /> : 
                       framework.status === 'Needs Attention' ? <AlertTriangle className="h-3 w-3" /> : null}
                      {framework.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Audit Readiness</span>
                      <span className="font-medium text-white">{framework.progress}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${framework.progress}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 + (index * 0.1) }}
                        className={`h-full rounded-full ${framework.progress >= 90 ? 'bg-emerald-500' : framework.progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'} shadow-[0_0_10px_currentColor]`}
                      />
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-xl border border-white/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-primary" />
                        AI Gap Analysis
                      </h4>
                      {!framework.gapAnalysis && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => handleRunGapAnalysis(framework)}
                          disabled={isAnalyzing === framework.id}
                        >
                          {isAnalyzing === framework.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                          Run Analysis
                        </Button>
                      )}
                    </div>

                    {framework.gapAnalysis ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Predicted Audit Risk</span>
                          <Badge variant={framework.gapAnalysis.predicted_audit_risk === 'High' ? 'destructive' : framework.gapAnalysis.predicted_audit_risk === 'Medium' ? 'warning' : 'success'} className="text-[10px] h-5">
                            {framework.gapAnalysis.predicted_audit_risk}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] font-medium text-slate-500 uppercase">Evidence Gaps</span>
                          <div className="flex flex-wrap gap-2">
                            {framework.gapAnalysis.evidence_gaps.map((gap: string, i: number) => (
                              <span key={i} className="text-[10px] bg-white/5 border border-white/10 rounded px-2 py-0.5 text-slate-300">
                                {gap}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] font-medium text-slate-500 uppercase">Recommended Actions</span>
                          <div className="space-y-1.5">
                            {framework.gapAnalysis.recommended_actions.slice(0, 2).map((action: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-[11px] text-slate-400 group">
                                <ChevronRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                                <span>{action.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-[11px] text-slate-500 italic">No predictive analysis performed yet.</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                    <div className="flex items-center text-slate-500">
                      <Clock className="mr-1.5 h-3.5 w-3.5" />
                      Next Audit: {framework.nextAudit}
                    </div>
                    <Button variant="link" className="h-auto p-0 text-primary hover:text-primary/80 text-xs">View Controls</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

