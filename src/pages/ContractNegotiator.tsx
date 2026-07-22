import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSearch, Zap, AlertTriangle, ShieldCheck, Scale, FileText, Loader2, PlayCircle, History, ExternalLink, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { cn } from '@/src/lib/utils';
import { GoogleGenAI } from "@google/genai";
import { useAuth } from '../lib/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';

export function ContractNegotiator() {
  const { profile } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [contractText, setContractText] = useState('');
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (profile?.organizationId) {
      fetchHistory();
    }
  }, [profile?.organizationId]);

  const fetchHistory = async () => {
    if (!profile?.organizationId) return;
    const q = query(
      collection(db, 'contract_audits'),
      where('organizationId', '==', profile.organizationId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    setAuditHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const analyzeContract = async () => {
    if (!contractText.trim() || !profile?.organizationId) return;
    setIsAnalyzing(true);
    setResults(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Act as a senior Cyber Lawyer and GRC lead. Analyze the following security clauses from a vendor contract:
      ${contractText}
      Compare this against industry standards (ISO 27001/GDPR). Identify 3 risky clauses and suggest "counter-language" for negotiation.
      Return JSON: { "score": 0-100, "risks": [{ "clause": "...", "risk": "...", "counter": "..." }], "summary": "..." }`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const cleanJson = (result.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      setResults(parsed);

      // Save to History
      await addDoc(collection(db, 'contract_audits'), {
        title: `Audit - ${new Date().toLocaleDateString()}`,
        summary: parsed.summary,
        score: parsed.score,
        risks: parsed.risks,
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });
      fetchHistory();
    } catch (e) {
      console.error("Analysis failed", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteAudit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDoc(doc(db, 'contract_audits', id));
    fetchHistory();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display">AI Contract Negotiator</h1>
          <p className="text-slate-400 mt-1">Audit security clauses in vendor contracts with AI legal intelligence.</p>
        </div>
        <div className="flex gap-2">
           <Button 
             variant="ghost" 
             onClick={() => setShowHistory(!showHistory)}
             className={cn("text-slate-500 hover:text-white bg-white/[0.03]", showHistory && "bg-primary/20 text-primary")}
           >
              <History className="h-4 w-4 mr-2" />
              History
           </Button>
           <Button onClick={() => { setResults(null); setContractText(''); setShowHistory(false); }} className="bg-indigo-600 hover:bg-indigo-500 text-white border-glow">
              <Plus className="h-4 w-4 mr-2" />
              New Audit
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Editor Area */}
        <div className="space-y-4">
           {showHistory ? (
              <Card className="bg-slate-900/40 border-white/5 h-full overflow-hidden flex flex-col">
                 <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Audit History</CardTitle>
                 </CardHeader>
                 <CardContent className="flex-1 overflow-y-auto space-y-3 pb-6">
                    {auditHistory.length === 0 ? (
                      <div className="text-center py-20 text-slate-600 italic">No previous audits found.</div>
                    ) : (
                      auditHistory.map((audit) => (
                        <div 
                          key={audit.id} 
                          onClick={() => { setResults(audit); setContractText(''); setShowHistory(false); }}
                          className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors cursor-pointer group flex justify-between items-center"
                        >
                           <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                audit.score > 70 ? "bg-emerald-500" : "bg-rose-500"
                              )} />
                              <div>
                                 <p className="text-sm font-bold text-white">{audit.title}</p>
                                 <p className="text-[10px] text-slate-500 uppercase">{new Date(audit.createdAt).toLocaleDateString()}</p>
                              </div>
                           </div>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             onClick={(e) => deleteAudit(audit.id, e)}
                             className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
                           >
                              <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                      ))
                    )}
                 </CardContent>
              </Card>
           ) : (
              <Card className="bg-slate-900/40 border-white/5 h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Contract Snippet</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 pb-6">
                    <textarea 
                      className="w-full h-96 bg-black/40 border border-white/10 rounded-xl p-6 text-slate-300 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none transition-all duration-300 placeholder:text-slate-700"
                      placeholder="Paste the security or data protection clauses here (e.g., Section 4: Data Security)..."
                      value={contractText}
                      onChange={(e) => setContractText(e.target.value)}
                    />
                    <div className="mt-6">
                        <Button 
                          onClick={analyzeContract}
                          disabled={isAnalyzing || !contractText}
                          className="w-full h-14 bg-white text-black hover:bg-slate-200 rounded-2xl font-bold text-lg shadow-xl shadow-white/5"
                        >
                          {isAnalyzing ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />}
                          Audit Risk Invariants
                        </Button>
                    </div>
                </CardContent>
              </Card>
           )}
        </div>

        {/* Results Area */}
        <div className="space-y-6">
           <AnimatePresence mode="wait">
              {!results && !isAnalyzing ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-white/5 rounded-3xl"
                >
                   <Scale className="h-16 w-16 text-slate-800 mb-6" />
                   <h3 className="text-lg font-bold text-slate-500 mb-2">Legal Readiness Engine Idle</h3>
                   <p className="text-slate-600 text-sm max-w-xs">Guardentra AI analyzes liability, data sovereignty, and breach notification windows.</p>
                </motion.div>
              ) : isAnalyzing ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-8 py-10"
                >
                   <div className="flex flex-col items-center justify-center space-y-6 text-center">
                      <div className="relative">
                         <div className="w-24 h-24 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                         <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-indigo-400" />
                         </div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-2">AI Attorney at Work</h3>
                        <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Cross-referencing with ISO 27001:2022 & GDPR</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                      {[1, 2].map(i => (
                        <div key={i} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
                      ))}
                   </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                   {/* Score Center */}
                   <div className="glass-panel p-8 rounded-3xl border border-white/5 bg-gradient-to-br from-indigo-900/10 to-transparent">
                      <div className="flex items-center justify-between mb-6">
                         <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Liability Score</h3>
                         <Badge className={cn(
                           "px-4 py-1 text-lg font-mono font-bold",
                           results.score > 70 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                         )}>
                           {results.score}/100
                         </Badge>
                      </div>
                      <p className="text-white text-lg font-medium leading-relaxed italic">"{results.summary}"</p>
                   </div>

                   {/* Risk Items */}
                   <div className="space-y-4">
                      {results.risks.map((risk: any, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4 hover:border-indigo-500/30 transition-all group"
                        >
                           <div className="flex items-start gap-4">
                              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 mt-1">
                                 <AlertTriangle className="h-4 w-4" />
                              </div>
                              <div className="space-y-1">
                                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Risky Provision</h4>
                                 <p className="text-sm text-slate-300 font-serif italic">"{risk.clause}"</p>
                              </div>
                           </div>

                           <div className="pl-12 space-y-4 border-l border-white/5 ml-4">
                              <div>
                                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Impact Analysis</h4>
                                 <p className="text-xs text-rose-400 font-medium">{risk.risk}</p>
                              </div>
                              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                 <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <ShieldCheck className="h-3 w-3" />
                                    AI Proposed Counter
                                 </h4>
                                 <p className="text-xs text-slate-200 font-mono leading-relaxed">{risk.counter}</p>
                              </div>
                           </div>
                        </motion.div>
                      ))}
                   </div>

                   <Button className="w-full bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 py-6">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Export GRC Revision Report (PDF)
                   </Button>
                </motion.div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const Plus = ({ className }: { className?: string }) => (
  <svg className={className} 
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M5 12h14"/><path d="M12 5v14"/>
  </svg>
);
