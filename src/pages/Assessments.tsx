import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  ClipboardCheck, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Sparkles,
  Loader2,
  FileText,
  UserPlus,
  X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from '@/src/lib/utils';

interface Assessment {
  id: string;
  vendorId: string;
  vendorName: string;
  frameworkName: string;
  status: 'Draft' | 'Sent' | 'In Progress' | 'Under Review' | 'Completed';
  progress: number;
  dueDate: string;
  questions: any[];
  organizationId: string;
  createdAt: string;
}

export function Assessments() {
  const { profile, loading } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form State
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedFrameworkId, setSelectedFrameworkId] = useState('');
  const [reviewAssessment, setReviewAssessment] = useState<Assessment | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewAnalysis, setReviewAnalysis] = useState<{ summary: string; rating: string; recommendation: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!profile?.organizationId) return;

    const q = query(
      collection(db, 'assessments'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Assessment[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Assessment);
      });
      setAssessments(data);
      setIsLoading(false);
    });

    // Fetch vendors and frameworks for creation
    const fetchMetadata = async () => {
      const vSnap = await getDocs(query(collection(db, 'vendors'), where('organizationId', '==', profile.organizationId)));
      setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const fSnap = await getDocs(query(collection(db, 'compliance'), where('organizationId', '==', profile.organizationId)));
      setFrameworks(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchMetadata();

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const handleReviewAssessment = async (assessment: Assessment) => {
    setReviewAssessment(assessment);
    setReviewAnalysis(null);
    setIsReviewing(true);
    
    // Auto-trigger AI analysis if completed
    if (assessment.status === 'Under Review' || assessment.status === 'Completed') {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const answers = assessment.questions.map(q => `${q.question}: ${q.answer || 'No Answer'}`).join('\n');
        
        const prompt = `Analyze vendor assessment for "${assessment.vendorName}" against "${assessment.frameworkName}".
        Answers:
        ${answers}
        
        Provide a risk summary, an overall security rating (A-F), and one primary recommendation.
        Return JSON: { "summary": "...", "rating": "...", "recommendation": "..." }`;

        const result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        setReviewAnalysis(JSON.parse(result.text || "{}"));
      } catch (e) {
        console.error("AI Review failed:", e);
      }
    }
  };

  const handleApproveAssessment = async () => {
    if (!reviewAssessment) return;
    try {
      await updateDoc(doc(db, 'assessments', reviewAssessment.id), {
        status: 'Completed',
        progress: 100
      });
      setIsReviewing(false);
    } catch (e) {
      console.error("Approval failed:", e);
    }
  };

  const handleCreateAssessment = async () => {
    if (!selectedVendorId || !selectedFrameworkId || !profile?.organizationId) return;
    setIsGenerating(true);
    
    try {
      const vendor = vendors.find(v => v.id === selectedVendorId);
      const framework = frameworks.find(f => f.id === selectedFrameworkId);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Act as a GRC Auditor. Generate a structured security assessment questionnaire for vendor "${vendor.name}" against the "${framework.name}" framework.
      Include 10 critical security questions with categories.
      Return a JSON array of objects:
      [
        {
          "id": "q1",
          "category": "Data Protection",
          "question": "Does the vendor encrypt data at rest?",
          "type": "boolean",
          "options": ["Yes", "No", "N/A"]
        }
      ]`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = result.text || '[]';
      const questions = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

      await addDoc(collection(db, 'assessments'), {
        vendorId: selectedVendorId,
        vendorName: vendor.name,
        frameworkName: framework.name,
        status: 'Sent',
        progress: 0,
        progressPct: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        questions,
        portalOpen: true,
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });

      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to generate assessment:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display text-glow">Structured Assessments</h1>
          <p className="text-slate-400 mt-1">AI-powered questionnaire engine and vendor collaboration.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-primary hover:bg-primary/90 text-white">
          <Plus className="h-4 w-4 mr-2" />
          New Assessment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900/50 border-white/5 p-4 flex flex-col justify-center items-center text-center">
            <Badge variant="outline" className="mb-2 bg-blue-500/10 text-blue-400 border-blue-500/20">Active Assessments</Badge>
            <div className="text-3xl font-bold text-white">{assessments.filter(a => a.status !== 'Completed').length}</div>
        </Card>
        <Card className="bg-slate-900/50 border-white/5 p-4 flex flex-col justify-center items-center text-center">
            <Badge variant="outline" className="mb-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Avg Completion</Badge>
            <div className="text-3xl font-bold text-white">
                {assessments.length > 0 ? Math.round(assessments.reduce((acc, curr) => acc + curr.progress, 0) / assessments.length) : 0}%
            </div>
        </Card>
        <Card className="bg-slate-900/50 border-white/5 p-4 flex flex-col justify-center items-center text-center">
            <Badge variant="outline" className="mb-2 bg-amber-500/10 text-amber-400 border-amber-500/20">Overdue</Badge>
            <div className="text-3xl font-bold text-white">0</div>
        </Card>
        <Card className="bg-slate-900/50 border-white/5 p-4 flex flex-col justify-center items-center text-center">
            <Badge variant="outline" className="mb-2 bg-purple-500/10 text-purple-400 border-purple-500/20">AI Scans Ready</Badge>
            <div className="text-3xl font-bold text-white">{assessments.filter(a => a.status === 'Under Review').length}</div>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-white/5">
        <CardHeader>
          <CardTitle className="text-white">Assessment Tracker</CardTitle>
          <CardDescription className="text-slate-500">Monitor vendor response status and compliance progress.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input placeholder="Search assessments..." className="pl-10 bg-black/20 border-white/10 text-white" />
            </div>
            <Button variant="outline" className="border-white/10 text-slate-400"><Filter className="h-4 w-4 mr-2" /> Filter</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-4">Vendor</th>
                  <th className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-4">Framework</th>
                  <th className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-4">Status</th>
                  <th className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-4">Progress</th>
                  <th className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-4">Due Date</th>
                  <th className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading assessment stream...
                    </td>
                  </tr>
                ) : assessments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No active assessments. Launch one to begin vendor vetting.
                    </td>
                  </tr>
                ) : (
                  assessments.map((a) => (
                    <tr key={a.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                            <FileText className="h-4 w-4 text-slate-400" />
                          </div>
                          <span className="font-bold text-white text-sm">{a.vendorName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-tighter text-indigo-400 border-indigo-500/20">
                          {a.frameworkName}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider",
                          a.status === 'Sent' ? "bg-amber-500/10 text-amber-400" :
                          a.status === 'In Progress' ? "bg-blue-500/10 text-blue-400" :
                          a.status === 'Completed' ? "bg-emerald-500/10 text-emerald-400" :
                          "bg-slate-500/10 text-slate-400"
                        )}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-[60px] h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${a.progress}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{a.progress}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-500 font-mono italic">{a.dueDate}</td>
                      <td className="py-4 px-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-slate-400 hover:text-primary transition-colors mr-2"
                          onClick={() => {
                            const url = `${window.location.origin}/portal/${a.id}`;
                            navigator.clipboard.writeText(url);
                          }}
                          title="Copy Vendor Portal Link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white transition-colors mr-2"
                          onClick={() => handleReviewAssessment(a)}
                          title="Review Assessment"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Review Assessment Modal */}
      {isReviewing && reviewAssessment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel max-w-4xl w-full h-[80vh] flex flex-col rounded-2xl border border-white/10"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
               <div>
                  <h2 className="text-xl font-bold text-white leading-none mb-1">{reviewAssessment.vendorName}</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">{reviewAssessment.frameworkName} Review</p>
               </div>
               <Button variant="ghost" size="sm" onClick={() => setIsReviewing(false)} className="text-slate-500 hover:text-white">
                  <X className="h-5 w-5" />
               </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Response Intelligence</h3>
                     {reviewAssessment.questions.map((q, idx) => (
                        <div key={q.id} className="space-y-3">
                           <div className="flex gap-4">
                              <span className="text-xs font-mono text-slate-700 mt-1">0{idx + 1}</span>
                              <div className="flex-1">
                                 <p className="text-sm font-medium text-slate-200 mb-2">{q.question}</p>
                                 <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                                    <p className="text-sm text-primary font-medium">{q.answer || 'No response provided.'}</p>
                                 </div>
                                 <div className="mt-2 flex items-center gap-2">
                                    <Badge variant="outline" className="text-[9px] py-0 px-1 border-white/5 text-slate-500">{q.category}</Badge>
                                 </div>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>

                  <div className="space-y-6">
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">AI Risk Audit</h3>
                     
                     <Card className="bg-indigo-500/5 border-indigo-500/20 overflow-hidden">
                        <CardHeader className="pb-2">
                           <CardTitle className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                              <Sparkles className="h-4 w-4" />
                              Automated Scoring
                           </CardTitle>
                        </CardHeader>
                        <CardContent>
                           {!reviewAnalysis ? (
                              <div className="flex items-center gap-3 py-4 text-slate-500 italic text-xs">
                                 <Loader2 className="h-4 w-4 animate-spin" />
                                 Running cross-reference analysis...
                              </div>
                           ) : (
                              <div className="space-y-4 pt-2">
                                 <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400 font-mono">Risk Rating</span>
                                    <span className={cn(
                                       "text-3xl font-black font-mono",
                                       ['A', 'B'].includes(reviewAnalysis.rating) ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                       {reviewAnalysis.rating}
                                    </span>
                                 </div>
                                 <p className="text-[11px] text-slate-300 leading-relaxed italic border-l-2 border-primary pl-3 py-1">
                                    "{reviewAnalysis.summary}"
                                 </p>
                                 <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                    <p className="text-[9px] font-bold text-indigo-300 uppercase mb-1">CISO Recommendation</p>
                                    <p className="text-[10px] text-slate-300">{reviewAnalysis.recommendation}</p>
                                 </div>
                              </div>
                           )}
                        </CardContent>
                     </Card>

                     <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                        <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-widest">Decision Terminal</h4>
                        <div className="space-y-3">
                           <Button 
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                            onClick={handleApproveAssessment}
                           >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Sign Off & Close
                           </Button>
                           <Button variant="outline" className="w-full border-white/10 text-slate-400">
                             Request Remediation
                           </Button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Assessment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel max-w-lg w-full p-8 rounded-2xl border border-white/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-white font-display">AI Questionnaire Launch</h2>
            </div>
            
            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Vendor</label>
                  <select 
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Choose a vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
               </div>
               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Apply Framework Standard</label>
                  <select 
                    value={selectedFrameworkId}
                    onChange={(e) => setSelectedFrameworkId(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select standard...</option>
                    {frameworks.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
               </div>

               <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                  <p className="text-xs text-indigo-300 leading-relaxed">
                    <strong>AI Note:</strong> Launching will automatically map NIST/SOC controls to a vendor-ready portal. The AI will generate follow-up logic based on their specific industry category.
                  </p>
               </div>

               <div className="flex gap-3 pt-4">
                  <Button variant="ghost" className="flex-1 text-slate-400" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                  <Button 
                    className="flex-1 bg-primary text-white" 
                    onClick={handleCreateAssessment}
                    disabled={!selectedVendorId || !selectedFrameworkId || isGenerating}
                  >
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Launch Assessment
                  </Button>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

