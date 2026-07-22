import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Building2, Globe, CheckCircle2, ChevronRight, Loader2, Sparkles, Target, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { db } from '../firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { seedProfessionalData } from '../lib/seeding';
import { logOut } from '../lib/firebase-utils';

const FRAMEWORKS = [
  { id: 'iso27001', name: 'ISO 27001:2022', icon: Shield, desc: 'Global information security standard' },
  { id: 'soc2', name: 'SOC 2 Type II', icon: Target, desc: 'Security, Availability, and Privacy' },
  { id: 'nist', name: 'NIST CSF 2.0', icon: Globe, desc: 'Critical infrastructure protection' },
  { id: 'hipaa', name: 'HIPAA', icon: Shield, desc: 'Healthcare data privacy' },
];

export function Onboarding() {
  const { profile, user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already onboarded
  React.useEffect(() => {
    if (!loading && (profile?.onboarded || localStorage.getItem('guardentra_onboarded') === 'true')) {
      console.log("Onboarding: User already onboarded in profile state, redirecting to dashboard");
      navigate('/dashboard');
    }
  }, [profile?.onboarded, loading, navigate]);

  const handleNext = () => {
    setError(null);
    if (step === 1 && !orgName.trim()) {
      setError("Please enter your organization name");
      return;
    }
    if (step === 1 && orgName.length < 2) {
      setError("Organization name is too short");
      return;
    }
    setStep(step + 1);
  };

  const handleFinish = async () => {
    if (!user) {
      setError("User session is missing. Please sign in again.");
      return;
    }
    setIsFinishing(true);
    setError(null);

    const activeOrgId = profile?.organizationId || `org_${user.uid}`;
    
    // Set immediate client-side onboarding state so they are never locked out
    localStorage.setItem('guardentra_onboarded', 'true');
    localStorage.setItem('guardentra_fallback_org_id', activeOrgId);

    try {
      console.log("Onboarding: Starting finish process for org:", activeOrgId);
      
      // 1. Update Organization
      try {
        await updateDoc(doc(db, 'organizations', activeOrgId), {
          name: orgName || `${user.displayName || 'User'}'s Organization`,
          industry: industry || 'SaaS',
          onboarded: true,
          setupAt: new Date().toISOString()
        });
        console.log("Onboarding: Organization document updated successfully");
      } catch (e: any) {
        console.warn("Onboarding: Organization update failed:", e);
      }

      // 2. Initialize Selected Frameworks
      if (selectedFrameworks.length > 0) {
        console.log("Onboarding: Initializing frameworks...", selectedFrameworks);
        try {
          await Promise.all(selectedFrameworks.map(async (frameworkId) => {
            const fw = FRAMEWORKS.find(f => f.id === frameworkId);
            return addDoc(collection(db, 'compliance'), {
              name: fw?.name || frameworkId,
              organizationId: activeOrgId,
              status: 'Active',
              progress: 0,
              activatedAt: new Date().toISOString()
            });
          }));
          console.log("Onboarding: Frameworks initialized");
        } catch (e: any) {
          console.warn("Onboarding: Frameworks initialization failed:", e);
        }
      }

      // 3. Seed Professional Data Templates
      console.log("Onboarding: Seeding professional metrics...");
      try {
        await seedProfessionalData({
          organizationId: activeOrgId,
          industry: industry || 'SaaS',
          frameworks: selectedFrameworks
        });
        console.log("Onboarding: Seeding completed");
      } catch (e: any) {
        console.warn("Onboarding: Seeding failed, proceeding with local fallback:", e);
      }

      // 4. Update User Profile
      console.log("Onboarding: Updating user profile...");
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          onboarded: true,
          updatedAt: new Date().toISOString(),
          organizationId: activeOrgId
        });
        console.log("Onboarding: User profile updated successfully");
      } catch (e: any) {
        console.warn("Onboarding: User profile update failed:", e);
      }

      // 5. Finalize
      console.log("Onboarding: Setup complete. Navigating...");
      navigate('/dashboard');
    } catch (err: any) {
      console.warn("Onboarding Finalization warning (proceeding anyway):", err);
      navigate('/dashboard');
    } finally {
      setIsFinishing(false);
    }
  };

  const toggleFramework = (id: string) => {
    setSelectedFrameworks(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
      
      {/* Top Nav for escape */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50">
        <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Back to Landing</span>
        </Link>
        <Button variant="ghost" onClick={logOut} className="text-slate-500 hover:text-rose-400">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <div className="max-w-2xl w-full relative">
        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-white/5 rounded-full mb-12 overflow-hidden flex">
          <motion.div 
            className="h-full bg-primary"
            animate={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Step 01 / Identity</Badge>
                <h1 className="text-4xl font-bold text-white tracking-tight font-display">Let's build your security foundation.</h1>
                <p className="text-slate-400">Define your organization to tailor the AI risk mapping.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Organization Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input 
                      placeholder="e.g. Acme Cybersec"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="pl-12 h-14 bg-white/5 border-white/10 text-lg text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Industry Vertical</label>
                  <select 
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full h-14 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="" disabled>Select industry...</option>
                    <option value="FinTech">FinTech / Banking</option>
                    <option value="HealthTech">Healthcare / Life Sciences</option>
                    <option value="SaaS">SaaS / Software</option>
                    <option value="E-commerce">Retail / E-commerce</option>
                    <option value="GovTech">Government / Public Sector</option>
                  </select>
                </div>
              </div>

              <Button 
                onClick={handleNext}
                className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20"
              >
                Continue to Frameworks <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Step 02 / Scope</Badge>
                <h1 className="text-4xl font-bold text-white tracking-tight font-display">Target Compliance Goals.</h1>
                <p className="text-slate-400">Select the frameworks you need to map against your risk register.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FRAMEWORKS.map((fw) => {
                  const Icon = fw.icon;
                  const isSelected = selectedFrameworks.includes(fw.id);
                  return (
                    <Card 
                      key={fw.id}
                      className={cn(
                        "cursor-pointer transition-all border-white/10 bg-white/5 hover:border-primary/50 group",
                        isSelected && "ring-2 ring-primary border-primary bg-primary/10"
                      )}
                      onClick={() => toggleFramework(fw.id)}
                    >
                      <CardContent className="p-6 flex items-start gap-4">
                        <div className={cn(
                          "p-2 rounded-lg bg-white/5 border border-white/10 group-hover:border-primary/50 transition-colors",
                          isSelected && "bg-primary/20 border-primary"
                        )}>
                          <Icon className={cn("h-5 w-5 text-slate-400", isSelected && "text-primary")} />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-white text-sm">{fw.name}</p>
                          <p className="text-[10px] text-slate-500 leading-tight">{fw.desc}</p>
                        </div>
                        {isSelected && <CheckCircle2 className="ml-auto h-4 w-4 text-primary shrink-0" />}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex gap-4">
                <Button variant="ghost" onClick={() => setStep(1)} className="flex-1 text-slate-500">Back</Button>
                <Button 
                  disabled={selectedFrameworks.length === 0}
                  onClick={() => setStep(3)}
                  className="flex-[2] h-14 bg-primary hover:bg-primary/90 text-white"
                >
                  Confirm Strategy <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8"
            >
              <div className="flex justify-center flex-col items-center">
                 <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center mb-6">
                    <Sparkles className="h-10 w-10 text-emerald-400 text-glow" />
                 </div>
                 <h1 className="text-4xl font-bold text-white font-display">Ready to Launch.</h1>
                 <p className="text-slate-400 mt-2 max-w-md">Guardentra AI is ready to initialize your Risk Matrix and Compliance Roadmap for <span className="text-white font-bold">{orgName}</span>.</p>
              </div>

              <Card className="bg-white/5 border-white/10 p-6 text-left">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Onboarding Summary</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Organization</span>
                    <span className="text-white font-bold">{orgName}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Industry</span>
                    <span className="text-white font-bold">{industry}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Active Goals</span>
                    <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                      {selectedFrameworks.map(id => (
                        <Badge key={id} variant="outline" className="text-[9px] border-white/10">{id.toUpperCase()}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Button 
                onClick={handleFinish}
                disabled={isFinishing}
                className="w-full h-16 text-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-2xl shadow-primary/40 animate-pulse-slow"
              >
                {isFinishing ? <Loader2 className="h-6 w-6 animate-spin" /> : "Deploy Architecture"}
              </Button>

              {user?.email === 'atdhee.kurteshi@gmail.com' && (
                <div className="mt-8 pt-8 border-t border-white/5">
                  <Button 
                    variant="ghost" 
                    onClick={async () => {
                      if (!user) return;
                      await updateDoc(doc(db, 'users', user.uid), { onboarded: true });
                      navigate('/dashboard');
                    }}
                    className="text-[10px] text-slate-600 hover:text-slate-400 uppercase tracking-widest"
                  >
                    Skip Onboarding (Admin Bypass)
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
