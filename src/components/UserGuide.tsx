import React from 'react';
import { 
  Shield, 
  Search, 
  FileText, 
  Scale, 
  Activity, 
  BarChart4, 
  Zap, 
  CalendarDays,
  Target,
  Users,
  AlertTriangle,
  Sparkles,
  Command,
  LayoutDashboard,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';

interface GuideStep {
  icon: any;
  title: string;
  description: string;
  category: 'Strategic' | 'Operational' | 'Testing';
}

const steps: GuideStep[] = [
  {
    icon: LayoutDashboard,
    title: "The Command Center",
    description: "Your AI-powered cockpit. On every login, Guardentra AI aggregates risks, incidents, and audit scores into a 30-second strategic briefing.",
    category: "Strategic"
  },
  {
    icon: Target,
    title: "Risk Management",
    description: "Map your threat landscape. Log risks with severity levels and use AI-estimated 'Value at Risk' (VaR) for budget prioritization.",
    category: "Operational"
  },
  {
    icon: FileText,
    title: "Digital Draftsman",
    description: "Never start from a blank page again. The AI Draftsman cross-references your real-world risks with ISO 27001 or SOC2 to write custom policies.",
    category: "Strategic"
  },
  {
    icon: Scale,
    title: "Audit Lab",
    description: "Simulate an external audit. Upload your findings and let AI analyze your 'Red Flags' and readiness score before the actual auditor arrives.",
    category: "Testing"
  },
  {
    icon: CalendarDays,
    title: "GRC Calendar",
    description: "Visual timeline for compliance milestones. Schedule reviews, policy deadlines, and training slots in a centralized typographic grid.",
    category: "Operational"
  },
  {
    icon: Zap,
    title: "Cloud Connectors",
    description: "Connect GitHub, AWS, or Okta. Guardentra performs background telemetry scans to identify automated control failures.",
    category: "Operational"
  },
  {
    icon: BarChart4,
    title: "Executive Reports",
    description: "Synthesize board-ready briefings. AI combines all platform data into a high-level summary of organization safety and strategic outlook.",
    category: "Strategic"
  },
  {
    icon: Activity,
    title: "Platform Health",
    description: "Verify the integrity of your GRC engine. Run the ISTQB-compliant regression suite to ensure tenant isolation.",
    category: "Testing"
  },
  {
    icon: BookOpen,
    title: "The Master Plan",
    description: "Access the detailed Feature Deployment Plan in the Documentation tab to see how every module works under the hood.",
    category: "Strategic"
  }
];

export function UserGuide({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-5xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[85vh] max-h-[800px]"
          >
            {/* Sidebar Navigation inside Guide */}
            <div className="w-full md:w-80 bg-black/20 p-8 border-r border-white/5 space-y-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/20 rounded-xl border border-primary/30">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white font-display">User Manual</h2>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-3">Core Pillars</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-400 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Strategic Governance
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Operational Control
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Assurance & Testing
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2 text-primary font-mono text-[10px] uppercase font-bold mb-2">
                    <Command className="h-3 w-3" /> UX Tip
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed italic">
                    "Use the Sidebar or 'Command Center' for quick access. AI features are marked with Sparkles."
                  </p>
                </div>
              </div>

              <Button onClick={onClose} className="w-full mt-auto bg-white/5 hover:bg-white/10 text-white border border-white/10">
                Close Manual
              </Button>
            </div>

            {/* Steps Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 bg-black/40 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {steps.map((step, idx) => (
                   <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="space-y-4 group"
                   >
                     <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-xl border transition-all duration-300",
                          step.category === 'Strategic' ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" :
                          step.category === 'Operational' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                          "bg-amber-500/10 border-amber-500/20 text-amber-400"
                        )}>
                          <step.icon className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{step.category}</span>
                     </div>
                     <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{step.title}</h4>
                     <p className="text-sm text-slate-400 leading-relaxed pr-4">
                        {step.description}
                     </p>
                   </motion.div>
                ))}
              </div>

              <div className="pt-8 border-t border-white/5">
                <div className="flex items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20">
                  <div className="p-3 bg-primary rounded-full">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white italic">"Welcome to the Future of Governance"</h5>
                    <p className="text-sm text-slate-400">Start by creating your first Risk or Incident to see the AI Command Center in action.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
