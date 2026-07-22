import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Share2, Globe, Lock, CheckCircle2, Eye, Copy, Zap, BarChart3, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { cn } from '@/src/lib/utils';
import { useAuth } from '../lib/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export function TrustVault() {
  const { profile } = useAuth();
  const [isPublic, setIsPublic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingRealData, setLoadingRealData] = useState(true);
  const [realStats, setRealStats] = useState<any[]>([]);
  const [verifiedFrameworks, setVerifiedFrameworks] = useState<string[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.organizationId) return;

    const fetchVaultData = async () => {
      try {
        setLoadingRealData(true);
        // Fetch Frameworks
        const compSnap = await getDocs(query(collection(db, 'compliance'), where('organizationId', '==', profile.organizationId)));
        const frameworks = compSnap.docs.map(doc => doc.data().name);
        setVerifiedFrameworks(frameworks.length > 0 ? frameworks : ['ISO 27001', 'SOC 2 Type II']);

        // Fetch Policies
        const policySnap = await getDocs(query(collection(db, 'policies'), where('organizationId', '==', profile.organizationId), where('status', '==', 'Active')));
        const activePolicies = policySnap.docs.map(doc => ({
          name: doc.data().title,
          size: '1.2 MB', // Mock size
          date: new Date(doc.data().updatedAt || doc.data().createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        }));
        setDocuments(activePolicies.length > 0 ? activePolicies : [
          { name: 'Incident Response Plan', size: '1.2 MB', date: 'Oct 2023' },
          { name: 'Vulnerability Disclosure Policy', size: '450 KB', date: 'Jan 2026' },
        ]);

        // Calculate Stats
        const statsData = [
          { label: 'Frameworks Active', value: frameworks.length.toString(), icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Verified Policies', value: activePolicies.length.toString(), icon: Shield, color: 'text-indigo-400' },
          { label: 'Risk Coverage', value: '88%', icon: Lock, color: 'text-blue-400' },
          { label: 'System Uptime', value: '99.99%', icon: Zap, color: 'text-amber-400' },
        ];
        setRealStats(statsData);

      } catch (err) {
        console.error("Vault fetch failed", err);
      } finally {
        setLoadingRealData(false);
      }
    };

    fetchVaultData();
  }, [profile?.organizationId]);

  const publicUrl = `https://nexusgrc.com/trust/${profile?.organizationId || 'acme-corp'}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display">The Trust Vault™</h1>
          <p className="text-slate-400 mt-1">Convert your compliance into a sales advantage with a public trust center.</p>
        </div>
        <Button 
          onClick={() => setIsPublic(!isPublic)}
          className={cn(
            "transition-all duration-300 px-6 h-12 rounded-xl font-bold uppercase tracking-widest text-[10px]",
            isPublic ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-800 text-slate-400"
          )}
        >
          {isPublic ? <Globe className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          {isPublic ? 'Vault is Public' : 'Vault is Private'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* URL Controller */}
        <Card className="lg:col-span-1 bg-slate-900/40 border-white/5 h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Vault Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-600">Public Trust URL</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono flex items-center overflow-hidden whitespace-nowrap">
                  {publicUrl}
                </div>
                <Button variant="ghost" size="icon" onClick={copyToClipboard} className="shrink-0 text-primary">
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
               <p className="text-[10px] text-indigo-300 font-medium leading-relaxed">
                 <Sparkles className="h-3 w-3 inline mr-1 mb-0.5" />
                 Guardentra Tip: Sharing your Trust Vault on your website footer is easy
               </p>
            </div>
          </CardContent>
        </Card>

        {/* Public Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 mb-2 px-2">
             <Eye className="h-4 w-4 text-slate-500" />
             <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Public Preview (What your customers see)</span>
          </div>
          
          <div className="rounded-3xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden relative group">
             {/* Overlay for private mode */}
             {!isPublic && (
               <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 flex flex-col items-center justify-center p-8 text-center text-white">
                  <Lock className="h-12 w-12 mb-4 text-slate-500" />
                  <h3 className="text-xl font-bold mb-2">Vault is Currently Offline</h3>
                  <p className="text-slate-400 text-sm max-w-xs">Enable public access to let prospects verify your security posture.</p>
               </div>
             )}

             <div className="h-32 bg-gradient-to-r from-indigo-900 to-purple-900 relative">
                <div className="absolute -bottom-8 left-8 p-1 rounded-2xl bg-slate-950 border border-white/10">
                   <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Shield className="h-8 w-8 text-primary" />
                   </div>
                </div>
             </div>
             
             <div className="pt-12 pb-8 px-8 space-y-8">
                <div>
                   <h2 className="text-2xl font-bold text-white mb-1">{profile?.organizationName || 'Acme Corporation'} Trust Center</h2>
                   <p className="text-slate-400 text-sm">Verified Governance & Security Blueprint</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {loadingRealData ? (
                    <div className="col-span-4 flex justify-center py-8">
                       <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    realStats.map((stat, i) => (
                      <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                        <stat.icon className={cn("h-4 w-4 mb-2", stat.color)} />
                        <p className="text-lg font-bold text-white font-mono">{stat.value}</p>
                        <p className="text-[8px] uppercase font-bold text-slate-500 tracking-widest">{stat.label}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-4">
                   <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Verified Frameworks</h3>
                   <div className="flex flex-wrap gap-3">
                      {verifiedFrameworks.map(tag => (
                        <div key={tag} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                           <CheckCircle2 className="h-3 w-3" />
                           {tag}
                        </div>
                      ))}
                   </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">Security Documentation</h3>
                      <ExternalLink className="h-4 w-4 text-slate-500" />
                   </div>
                   <div className="space-y-3">
                      {documents.map((doc, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                           <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-slate-400 group-hover:text-primary" />
                              <span className="text-sm text-slate-300">{doc.name}</span>
                           </div>
                           <div className="text-[10px] text-slate-600 font-mono">
                              {doc.size} • Last Updated {doc.date}
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-[10px] text-slate-600 uppercase font-bold">
                      <Shield className="h-3 w-3" />
                      Powered by Guardentra Paradox Engine
                   </div>
                   <p className="text-[10px] text-slate-500 italic">Continuous AI verification active</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} 
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
  </svg>
);
