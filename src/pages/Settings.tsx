import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Shield, 
  Bell, 
  Database, 
  Lock, 
  Eye, 
  Sparkles,
  Command,
  Save,
  Loader2,
  Globe
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { motion } from 'framer-motion';

export function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [copilotVerbosity, setCopilotVerbosity] = useState('concise');
  const [enableAutoScan, setEnableAutoScan] = useState(true);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
    }, 1200);
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2 flex items-center gap-3">
            <SettingsIcon className="h-10 w-10 text-primary" />
            System Preferences
          </h1>
          <p className="text-slate-400 text-lg">Configure AI behavior, tenant security, and automated scanning.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-white px-8">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Configuration
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation / Categories */}
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-white font-bold transition-all">
            <Cpu className="h-5 w-5 text-primary" />
            AI Copilot Tuning
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent text-slate-400 transition-all">
            <Shield className="h-5 w-5" />
            Security & MFA
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent text-slate-400 transition-all">
            <Database className="h-5 w-5" />
            Storage Quotas
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent text-slate-400 transition-all">
            <Bell className="h-5 w-5" />
            Notification Engine
          </button>
        </div>

        {/* Setting Panels */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Copilot Tuning
              </CardTitle>
              <CardDescription>Adjust the strategic reasoning and assistant parameters.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verbosity Level</label>
                <div className="flex gap-2">
                  {['Concise', 'Balanced', 'Deep Analysis'].map(v => (
                    <button 
                      key={v}
                      onClick={() => setCopilotVerbosity(v.toLowerCase())}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all",
                        copilotVerbosity === v.toLowerCase() ? "bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.2)]" : "bg-black/20 border-white/5 text-slate-400 hover:border-white/10"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Automated Risk Scanning</h4>
                  <p className="text-xs text-slate-500 italic pr-8">AI periodically scans connectors for new vulnerabilities without manual trigger.</p>
                </div>
                <button 
                  onClick={() => setEnableAutoScan(!enableAutoScan)}
                  className={cn(
                    "w-12 h-6 rounded-full p-1 transition-colors duration-300",
                    enableAutoScan ? "bg-primary" : "bg-slate-800"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-sm",
                    enableAutoScan ? "translate-x-6" : "translate-x-0"
                  )} />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Internal Model Bias</label>
                <select className="w-full bg-black/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-slate-300">
                  <option>Risk-Averse (Default)</option>
                  <option>Growth & Agility Focused</option>
                  <option>Compliance Regulatory Strict</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                Regional Data Residency
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 text-emerald-400 text-xs font-mono bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                <Globe className="h-4 w-4" />
                Data currently homed in: EU-West-2 (London)
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                As part of your GRC commitment, data storage locations are immutable after registration. To migrate regions, please contact Enterprise Support.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
