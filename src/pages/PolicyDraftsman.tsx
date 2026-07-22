import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  Sparkles, 
  FileText, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  Plus,
  Trash2,
  Save,
  MessageSquare,
  Zap,
  Info,
  ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/src/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Risk {
  id: string;
  title: string;
  severity: string;
}

interface AuditFinding {
  framework: string;
  redFlags: string[];
}

export function PolicyDraftsman() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeRisks, setActiveRisks] = useState<Risk[]>([]);
  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [policyType, setPolicyType] = useState('ISO 27001');
  const [customBrief, setCustomBrief] = useState('');
  const [includeRisks, setIncludeRisks] = useState(true);
  
  const [generatedPolicy, setGeneratedPolicy] = useState('');
  const [analysis, setAnalysis] = useState('');
  
  useEffect(() => {
    if (!profile?.organizationId) return;

    const fetchData = async () => {
      try {
        const riskSnap = await getDocs(query(collection(db, 'risks'), where('organizationId', '==', profile.organizationId)));
        const risks = riskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Risk));
        setActiveRisks(risks);

        const auditSnap = await getDocs(query(collection(db, 'audit_readiness'), where('organizationId', '==', profile.organizationId)));
        const audits = auditSnap.docs.map(doc => ({ ...doc.data() } as AuditFinding));
        setAuditFindings(audits);
      } catch (error) {
        console.error("Failed to fetch context:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [profile?.organizationId]);

  const generatePolicy = async () => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const context = {
        framework: policyType,
        risks: includeRisks ? activeRisks.map(r => `${r.title} (${r.severity})`) : [],
        auditGaps: auditFindings.flatMap(a => a.redFlags),
        brief: customBrief
      };

      const prompt = `Act as an elite GRC Consultant and Security Architect.
      Generate a comprehensive Enterprise Security Policy.
      
      Requirements:
      1. Compliance Framework: ${context.framework}
      2. Addressing the following Risks: ${context.risks.join(', ')}
      3. Mitigating these Audit Gaps: ${context.auditGaps.join(', ')}
      4. Additional Brief: ${context.brief}
      
      Output Format (JSON):
      {
        "title": "Title of the policy",
        "markdownContent": "Full markdown content of the policy including Purpose, Scope, Policy Statements, and Enforcement.",
        "rationale": "Explain how this policy specifically mitigates the provided risks and audit gaps."
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || "{}");
      setGeneratedPolicy(data.markdownContent);
      setAnalysis(data.rationale);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const savePolicy = async () => {
    if (!generatedPolicy || !profile?.organizationId) return;
    
    try {
      await addDoc(collection(db, 'policies'), {
        title: generatedPolicy.split('\n')[0].replace('# ', '') || "AI Generated Policy",
        content: generatedPolicy,
        category: policyType,
        status: 'Draft',
        version: '1.0',
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      navigate('/policies');
    } catch (error) {
       console.error("Save failed:", error);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display flex items-center gap-3">
            <Zap className="h-10 w-10 text-primary" />
            AI Policy Draftsman
          </h1>
          <p className="text-slate-400 mt-2 text-lg max-w-2xl">
            Automatically synthesize mission-critical security policies by mapping your risk landscape to global frameworks.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/policies')} className="border-white/10 text-slate-400">
            Archive Ledger
          </Button>
          <Button 
            onClick={savePolicy} 
            disabled={!generatedPolicy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            Commit to Repository
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Configuration & Context */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Drafting Engine Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Compliance Framework</label>
                <select 
                  value={policyType}
                  onChange={(e) => setPolicyType(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:ring-1 focus:ring-primary"
                >
                  <option>ISO 27001:2022</option>
                  <option>SOC 2 Type II</option>
                  <option>NIST CSF 2.0</option>
                  <option>HIPAA/HITECH</option>
                  <option>GDPR Privacy</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Risk Landscape Mapping</label>
                  <Badge variant="outline" className={cn(includeRisks ? "bg-primary/20 text-primary" : "text-slate-600")}>
                    {includeRisks ? 'Active' : 'Muted'}
                  </Badge>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {activeRisks.map(risk => (
                    <div key={risk.id} className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                      <span className="text-xs text-slate-300 truncate max-w-[200px]">{risk.title}</span>
                      <Badge className={cn(
                        "text-[9px] uppercase",
                        risk.severity === 'Critical' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                        risk.severity === 'High' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                        "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}>
                        {risk.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Strategic Brief (Optional)</label>
                <textarea
                  placeholder="Include specific organizational constraints or focus areas..."
                  value={customBrief}
                  onChange={(e) => setCustomBrief(e.target.value)}
                  className="w-full min-h-[120px] p-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:ring-1 focus:ring-primary resize-none placeholder:text-slate-600"
                />
              </div>

              <Button 
                onClick={generatePolicy} 
                disabled={isGenerating}
                className="w-full bg-primary hover:bg-primary/90 text-white py-6 h-auto text-lg shadow-xl shadow-primary/20"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    Drafting Invariant Set...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-3" />
                    Generate Policy Draft
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-indigo-950/20 border-indigo-500/20">
            <CardContent className="p-4 flex gap-4">
              <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-1" />
              <div className="text-xs leading-relaxed text-indigo-300">
                Guardentra AI will cross-reference your <span className="font-bold text-white">Risk Register</span> and <span className="font-bold text-white">Audit Readiness scores</span> to generate controls that satisfy compliance while solving real security gaps.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: Generation & Preview */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-panel border-white/10 overflow-hidden flex flex-col min-h-[700px] bg-slate-900/40">
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Policy Workbench</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Tokens: 1,242</span>
                <Badge variant="outline" className="text-primary border-primary/20">v1.0 DRAFT</Badge>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4"
                  >
                    <div className="relative">
                      <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold font-display text-white">Synthesizing Security Logic</p>
                      <p className="text-sm">Gemini is mapping legal requirements to incident data...</p>
                    </div>
                  </motion.div>
                ) : generatedPolicy ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto prose prose-invert prose-indigo prose-sm "
                  >
                    <ReactMarkdown>{generatedPolicy}</ReactMarkdown>
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-20">
                    <FileText className="h-32 w-32 mb-6" />
                    <p className="text-2xl font-bold font-display">Repository Empty</p>
                    <p className="text-sm">Configure your parameters and trigger the drafting engine.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {analysis && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="bg-primary/5 border-primary/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                   <Shield className="h-32 w-32" />
                </div>
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary">Strategic Rationale</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 text-sm italic font-serif leading-relaxed">
                    {analysis}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
