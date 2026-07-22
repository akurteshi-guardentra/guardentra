import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  Shield, 
  CheckCircle2, 
  Clock, 
  Upload, 
  Send, 
  Loader2, 
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronLeft,
  Lock,
  FileText
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';

export function VendorPortal() {
  const { assessmentId } = useParams();
  const [assessment, setAssessment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);

  const handleFileUpload = () => {
    const files = ['SOC2_Type2_Report.pdf', 'ISO27001_Certificate.pdf', 'Insurance_Liability.png'];
    const nextFile = files[attachedFiles.length % files.length];
    setAttachedFiles(prev => [...prev, `${nextFile}`]);
  };

  useEffect(() => {
    const fetchAssessment = async () => {
      if (!assessmentId) return;
      const ref = doc(db, 'assessments', assessmentId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setAssessment({ id: snap.id, ...snap.data() });
        // Optional: populate existing answers
      }
      setIsLoading(false);
    };
    fetchAssessment();
  }, [assessmentId]);

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const calculateProgress = () => {
    if (!assessment?.questions) return 0;
    const answeredCount = Object.keys(answers).length;
    return Math.round((answeredCount / assessment.questions.length) * 100);
  };

  const handleSubmit = async () => {
    if (!assessmentId) return;
    setIsSubmitting(true);
    try {
      const ref = doc(db, 'assessments', assessmentId);
      await updateDoc(ref, {
        answers,
        progress: 100,
        status: 'Under Review',
        completedAt: new Date().toISOString()
      });
      setIsSuccess(true);
    } catch (error) {
      console.error("Submission failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Securing Connection...</p>
      </div>
    );
  }

  if (!assessment || isSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel max-w-lg w-full p-10 rounded-3xl border border-white/10 text-center"
        >
          {isSuccess ? (
            <>
                <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 border border-emerald-500/50">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">Submission Received</h1>
                <p className="text-slate-400 mb-8 leading-relaxed">
                    Thank you. Your security assessment has been successfully submitted to the Compliance Team. 
                    They will review the evidence and contact you if follow-up is required.
                </p>
                <div className="p-4 bg-white/5 rounded-xl text-xs text-slate-500 font-mono">
                    Ref ID: {assessmentId}
                </div>
            </>
          ) : (
            <>
                <div className="mx-auto w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-6 border border-rose-500/50">
                    <AlertTriangle className="h-8 w-8 text-rose-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">Portal Link Invalid</h1>
                <p className="text-slate-400 mb-8">
                    The requested security assessment could not be found or the link has expired.
                </p>
                <Button className="w-full bg-primary text-white" onClick={() => window.close()}>Back to Safety</Button>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  const currentQuestion = assessment.questions[currentStep];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans lowercase-labels">
      {/* Header */}
      <header className="h-20 border-b border-white/5 backdrop-blur-xl bg-black/40 flex items-center px-6 md:px-12 sticky top-0 z-50">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 border border-primary/50">
                <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
                <h1 className="text-lg font-bold text-white tracking-tight leading-none mb-1">Vendor Portal</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Secured by Guardentra</p>
            </div>
        </div>
        <div className="ml-auto flex items-center gap-6">
            <div className="hidden sm:block">
                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-widest">
                    <span>In-App Progress</span>
                    <span>{calculateProgress()}%</span>
                </div>
                <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${calculateProgress()}%` }} />
                </div>
            </div>
            <div className="h-10 w-[1px] bg-white/10" />
            <Badge variant="outline" className="text-[10px] border-white/10 uppercase tracking-widest text-slate-400 py-1">
                <Lock className="h-3 w-3 mr-1.5" /> Encrypted Link
            </Badge>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12">
        <div className="mb-12">
            <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">{assessment.frameworkName}</Badge>
                <span className="text-slate-600 text-sm italic">Assessment requested by CISO team</span>
            </div>
            <h2 className="text-4xl font-bold text-white tracking-tight">Security Questionnaire: {assessment.vendorName}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-8 space-y-8">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card className="bg-slate-900/50 border-white/5 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            <div className="mb-8">
                                <Badge variant="outline" className="border-white/10 text-slate-500 mb-4">{currentQuestion.category}</Badge>
                                <h3 className="text-2xl font-semibold text-white leading-tight">{currentQuestion.question}</h3>
                            </div>

                            <div className="space-y-3">
                                {currentQuestion.options ? (
                                    currentQuestion.options.map((option: string) => (
                                        <button
                                            key={option}
                                            onClick={() => handleAnswerChange(currentQuestion.id, option)}
                                            className={cn(
                                                "w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center justify-between border",
                                                answers[currentQuestion.id] === option 
                                                    ? "bg-primary/20 border-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]" 
                                                    : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                                            )}
                                        >
                                            <span className="font-medium">{option}</span>
                                            {answers[currentQuestion.id] === option && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                        </button>
                                    ))
                                ) : (
                                    <textarea 
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-slate-700 min-h-[120px] focus:ring-1 focus:ring-primary outline-none"
                                        placeholder="Type your response here..."
                                        value={answers[currentQuestion.id] || ''}
                                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                                    />
                                )}
                            </div>
                        </Card>
                    </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-between bg-black/20 p-6 rounded-2xl border border-white/5">
                    <Button 
                        variant="ghost" 
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                        className="text-slate-400"
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                    </Button>
                    <div className="text-xs text-slate-500 font-mono">
                        Question {currentStep + 1} of {assessment.questions.length}
                    </div>
                    {currentStep === assessment.questions.length - 1 ? (
                        <Button 
                           className="bg-emerald-600 hover:bg-emerald-500 text-white px-8"
                           onClick={handleSubmit}
                           disabled={isSubmitting || Object.keys(answers).length < assessment.questions.length}
                        >
                           {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                           Submit Assessment
                        </Button>
                    ) : (
                        <Button 
                            className="bg-primary hover:bg-primary/90 text-white px-8"
                            onClick={() => setCurrentStep(Math.min(assessment.questions.length - 1, currentStep + 1))}
                        >
                            Next <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    )}
                </div>
            </div>

            <aside className="md:col-span-4 space-y-6">
                <Card className="bg-slate-900/50 border-white/5 p-6 rounded-2xl">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Info className="h-3.5 w-3.5 text-primary" /> Evidence Hub
                    </h4>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                        Attach SOC 2 or ISO certificates to support your responses. AI will automatically verify signatures.
                    </p>
                    
                    <div className="space-y-3 mb-4">
                      {attachedFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-[10px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 text-primary" />
                            {file}
                          </div>
                          <span className="text-[8px] text-emerald-500 font-bold">VERIFIED</span>
                        </div>
                      ))}
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full border-white/10 text-slate-300 border-dashed hover:bg-white/5 h-20 flex flex-col gap-2"
                      onClick={handleFileUpload}
                    >
                        <Upload className="h-5 w-5 text-slate-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Add Attachment</span>
                    </Button>
                </Card>

                <Card className="bg-slate-900/50 border-white/5 p-6 rounded-2xl">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Portal Integrity</h4>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] text-slate-300">TLS 1.3 Encryption Active</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] text-slate-300">SOC 2 Compliant Data Store</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[10px] text-slate-300">Session Recorded for Audit</span>
                        </div>
                    </div>
                </Card>
            </aside>
        </div>
      </main>
      
      <footer className="p-8 text-center border-t border-white/5 mt-auto">
         <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em]">Built by Guardentra Intelligence Systems</p>
      </footer>
    </div>
  );
}

