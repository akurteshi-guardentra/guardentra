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
import { isLocallyOnboarded, setLocallyOnboarded } from '../lib/onboardingFlag';

const FRAMEWORKS = [
  {
    id: 'iso27001',
    name: 'ISO 27001:2022',
    icon: Shield,
    desc: 'The certification enterprise buyers ask for most often in security reviews.',
  },
  {
    id: 'soc2',
    name: 'SOC 2 Type II',
    icon: Target,
    desc: 'Audited proof of how you handle security, availability and confidentiality over time.',
  },
  {
    id: 'nist',
    name: 'NIST CSF 2.0',
    icon: Globe,
    desc: 'A practical control baseline. Common in US public sector and critical infrastructure.',
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    icon: Shield,
    desc: 'Required if you or your vendors touch protected health information.',
  },
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
    if (!loading && (profile?.onboarded || (user && isLocallyOnboarded(user.uid)))) {
      console.log("Onboarding: User already onboarded in profile state, redirecting to dashboard");
      navigate('/dashboard');
    }
  }, [profile?.onboarded, loading, user, navigate]);

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
    if (step === 1 && !industry) {
      setError("Please select your industry");
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
    // bootstrapUserProfile only sets role: 'member' for someone who joined an
    // existing org via invite — everyone else (including the fallback org id
    // above) is the org's own creator/admin. A joining member going through
    // this same wizard must not overwrite the shared org's name/industry or
    // re-run framework init/demo-data seeding on top of the admin's real data.
    const isOrgCreator = profile?.role !== 'member';

    // Set immediate client-side onboarding state so they are never locked out
    setLocallyOnboarded(user.uid);
    localStorage.setItem('guardentra_fallback_org_id', activeOrgId);

    try {
      console.log("Onboarding: Starting finish process for org:", activeOrgId);

      if (isOrgCreator) {
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
      } else {
        console.log("Onboarding: Invited member joining existing org — skipping org update/framework init/seeding");
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
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Step 1 of 3 · Organization</Badge>
                <h1 className="text-4xl font-bold text-white tracking-tight font-display">Let's set up your workspace.</h1>
                <p className="text-slate-400">
                  Two details, about a minute. They shape the vendor questionnaires, risk
                  scoring and reports you'll get by default — and you can change both later in
                  Settings.
                </p>
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
                      maxLength={120}
                      className="pl-12 h-14 bg-white/5 border-white/10 text-lg text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Industry</label>
                  <select 
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full h-14 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="" disabled>Select industry...</option>
                    <option value="FinTech">Financial services / FinTech</option>
                    <option value="Insurance">Insurance</option>
                    <option value="HealthTech">Healthcare / Life sciences</option>
                    <option value="SaaS">SaaS / Software</option>
                    <option value="E-commerce">Retail / E-commerce</option>
                    <option value="Manufacturing">Manufacturing / Industrial</option>
                    <option value="ProfessionalServices">Professional services</option>
                    <option value="Education">Education</option>
                    <option value="Energy">Energy / Utilities</option>
                    <option value="GovTech">Government / Public sector</option>
                    <option value="Nonprofit">Non-profit</option>
                    <option value="Other">Other</option>
                  </select>
                  <p className="pl-1 text-xs text-slate-500">
                    Sets your starting vendor categories and which regulations we watch for you.
                  </p>
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
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Step 2 of 3 · Frameworks</Badge>
                <h1 className="text-4xl font-bold text-white tracking-tight font-display">What do you report against?</h1>
                <p className="text-slate-400">
                  Pick every framework you're accountable for — more than one is normal. Where
                  two frameworks ask for the same control, your vendors answer it once instead
                  of repeating themselves, so questionnaires stay short as your scope grows.
                </p>
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
                  Review and finish <ChevronRight className="ml-2 h-5 w-5" />
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
                 <h1 className="text-4xl font-bold text-white font-display">You're all set.</h1>
                 <p className="text-slate-400 mt-2 max-w-md">
                   We'll set up <span className="text-white font-bold">{orgName}</span> with your
                   frameworks, a starting risk register and your vendor directory. Add your first
                   vendor next — that's where assessments and scoring begin.
                 </p>
              </div>

              <Card className="bg-white/5 border-white/10 p-6 text-left">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Your setup</h4>
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
                    <span className="text-slate-500">Frameworks</span>
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
                {isFinishing ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Finish setup'}
              </Button>

              {import.meta.env.DEV && (
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
