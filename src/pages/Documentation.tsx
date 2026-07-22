import React from 'react';
import { 
  FileText, 
  Shield, 
  Search, 
  Zap, 
  Scale, 
  CalendarDays, 
  Activity, 
  BarChart4, 
  Users, 
  AlertTriangle, 
  AlertCircle,
  Share2,
  Sparkles,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { motion } from 'framer-motion';

export function Documentation() {
  const sections = [
    {
      title: "Navigation & Command",
      features: [
        {
          name: "Live Command Center (Dashboard)",
          icon: Shield,
          desc: "Aggregates all modules into a strategic view. Includes an AI Intelligence Briefing that analyzes your real-time risk posture.",
          how: "On every load, AI scans your risks and audit scores. It caches results for 15 minutes to ensure high performance."
        },
        {
          name: "Executive Reporting",
          icon: BarChart4,
          desc: "Synthesizes board-ready reports using the Gemini AI engine.",
          how: "Select 'Generate Report' to have AI analyze cross-module trends and provide a strategic outlook."
        }
      ]
    },
    {
      title: "GRC Operations",
      features: [
        {
          name: "Risk Management",
          icon: AlertTriangle,
          desc: "The core risk register. Tracks severity, category, and mitigation plans.",
          how: "Log risks to feed the 'Value at Risk' (VaR) calculator on the dashboard."
        },
        {
          name: "Incident Tracker",
          icon: AlertCircle,
          desc: "Real-time security incident logging and lifecycle management.",
          how: "Track from 'Open' to 'Resolved'. AI uses incident volume to lower your readiness score."
        },
        {
          name: "Vendor Risk",
          icon: Users,
          desc: "Third-party risk management (TPRM). Includes criticality levels and assessment tracking.",
          how: "Store SOC2 reports and assessments to centralize vendor compliance."
        }
      ]
    },
    {
      title: "Strategy & Policy",
      features: [
        {
          name: "Compliance Frameworks",
          icon: CheckCircle2,
          desc: "Targeted tracking for ISO 27001, SOC 2, NIST, and HIPAA.",
          how: "Syncs with Audit Readiness scores to show real progress percentages."
        },
        {
          name: "AI Policy Draftsman",
          icon: FileText,
          desc: "An AI-powered document generator that writes full-scale enterprise policies.",
          how: "Select a category and framework. AI cross-references your active risks to ensure relevance."
        },
        {
          name: "Cloud Connectors",
          icon: Share2,
          desc: "Automated evidence collection from AWS, GitHub, Azure, etc.",
          how: "Simulate scans using AI to find automated control failures and evidence gaps."
        }
      ]
    },
    {
      title: "Assurance & Timeline",
      features: [
        {
          name: "Audit Readiness Lab",
          icon: Scale,
          desc: "Simulation environment to test your GRC posture against external auditors.",
          how: "Calculates a Readiness Score based on findings, risks, and incidents."
        },
        {
          name: "GRC Calendar",
          icon: CalendarDays,
          desc: "Centralized timeline for audits, reviews, and training.",
          how: "Uses a custom grid for clear visualization of compliance windows."
        }
      ]
    }
  ];

  return (
    <div className="max-w-[1000px] mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
            <BookOpen className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight font-display">Feature Deployment Plan</h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Guardentra is a unified governance engine. This manual documents the current operational capabilities of the platform.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-12 mt-12">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/5" />
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">{section.title}</h2>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {section.features.map((feature, fIdx) => (
                <motion.div 
                  key={fIdx}
                  whileHover={{ y: -4 }}
                  className="glass-panel p-6 rounded-2xl border border-white/5 relative group"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <feature.icon className="h-12 w-12 text-primary" />
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-bold text-white">{feature.name}</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    {feature.desc}
                  </p>
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                      <Zap className="h-3 w-3" /> Operational Logic
                    </div>
                    <p className="text-xs text-slate-300 italic leading-relaxed">
                      {feature.how}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}

        <div className="p-10 rounded-3xl bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/20 text-center relative overflow-hidden">
          <Sparkles className="absolute top-[-20px] left-[-20px] h-32 w-32 text-indigo-500/10 -rotate-12" />
          <h2 className="text-2xl font-bold text-white mb-4">The AI Co-Pilot Principle</h2>
          <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Guardentra does not just store data; it synthesizes it. Every module is connected to the Gemini AI engine which performs continuous "Contextual Reasoning." When you view a Risk, the AI is already preparing a mitigation policy. When you schedule an Audit, the AI is scanning your connectors for evidence gaps.
          </p>
        </div>
      </div>
    </div>
  );
}
