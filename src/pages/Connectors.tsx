import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Share2, 
  Cloud, 
  Database, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  MoreVertical,
  Trash2,
  Zap,
  Loader2,
  Lock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';

interface Connector {
  id: string;
  name: string;
  type: 'AWS' | 'GitHub' | 'Azure' | 'GCP' | 'Okta';
  status: 'Connected' | 'Disconnected' | 'Error';
  lastScan: string;
  findings: number;
  health: number;
  organizationId: string;
}

interface ScanResult {
  control: string;
  status: 'Pass' | 'Fail' | 'Warning';
  evidence: string;
  recommendation: string;
}

export function Connectors() {
  const { profile, loading } = useAuth();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<Record<string, ScanResult[]>>({});
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'connectors'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Connector[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Connector);
      });
      setConnectors(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const handleAddConnector = async (type: Connector['type']) => {
    if (!profile?.organizationId) return;
    
    try {
      await addDoc(collection(db, 'connectors'), {
        name: `${type} Production Environment`,
        type,
        status: 'Connected',
        lastScan: 'Never',
        findings: 0,
        health: 100,
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
    } catch (error) {
      console.error("Failed to add connector:", error);
    }
  };

  const handleDeleteConnector = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'connectors', id));
    } catch (error) {
      console.error("Failed to delete connector:", error);
    }
  };

  const runAIScan = async (connector: Connector) => {
    setIsScanning(connector.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Simulate a security compliance scan for a ${connector.type} environment. 
      Analyze common security controls (MFA, Encryption, Access Logging, Public Buckets).
      Return a JSON array of 4 scan results.
      Each result must have: control (string), status ('Pass' | 'Fail' | 'Warning'), evidence (string), recommendation (string).
      Make it realistic and technical.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const results = JSON.parse(result.text || "[]");
      setScanResults(prev => ({ ...prev, [connector.id]: results }));
      
      // Update connector status in Firestore
      const findings = results.filter((r: any) => r.status !== 'Pass').length;
      const health = Math.max(0, 100 - (findings * 15));
      
      await updateDoc(doc(db, 'connectors', connector.id), {
        lastScan: new Date().toLocaleString(),
        findings,
        health
      });

      // Also update compliance progress if findings are low
      if (findings === 0) {
        // Logic to find a related compliance framework and bump progress could go here
      }

    } catch (error) {
      console.error("Scan failed:", error);
    } finally {
      setIsScanning(null);
    }
  };

  const filteredConnectors = connectors.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display text-glow">
            Automated Connectors
          </h1>
          <p className="text-slate-400 mt-1">
            Continuous evidence collection from your cloud infrastructure.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Search connectors..." 
              className="pl-10 w-64 bg-black/20 border-white/10 text-white focus:border-primary/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            onClick={() => setShowAddModal(true)}
            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Connector
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Connectors', value: connectors.length, icon: Share2, color: 'text-blue-400' },
          { label: 'Active Scans', value: isScanning ? 1 : 0, icon: Zap, color: 'text-yellow-400' },
          { label: 'Avg. Health Score', value: connectors.length ? Math.round(connectors.reduce((acc, c) => acc + c.health, 0) / connectors.length) : 0, icon: Shield, color: 'text-emerald-400' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-panel p-6 rounded-xl border border-white/5 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon className="h-12 w-12" />
            </div>
            <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className={cn("text-3xl font-bold mt-2", stat.color)}>{stat.value}{stat.label.includes('Health') ? '%' : ''}</p>
          </motion.div>
        ))}
      </div>

      {/* Connectors Table - Recipe 1: Technical Dashboard */}
      <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
        <div className="grid grid-cols-6 p-4 border-b border-white/5 bg-white/5">
          <div className="col-span-2 text-[11px] font-serif italic uppercase tracking-widest text-slate-500">Connector Name</div>
          <div className="text-[11px] font-serif italic uppercase tracking-widest text-slate-500">Status</div>
          <div className="text-[11px] font-serif italic uppercase tracking-widest text-slate-500">Health</div>
          <div className="text-[11px] font-serif italic uppercase tracking-widest text-slate-500">Last Scan</div>
          <div className="text-[11px] font-serif italic uppercase tracking-widest text-slate-500 text-right">Actions</div>
        </div>

        <div className="divide-y divide-white/5">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Loading connectors...</p>
            </div>
          ) : filteredConnectors.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-500">
              <Share2 className="h-12 w-12 mb-4 opacity-20" />
              <p>No connectors found. Add your first cloud integration.</p>
            </div>
          ) : (
            filteredConnectors.map((connector) => (
              <div key={connector.id} className="group">
                <div className="grid grid-cols-6 p-4 items-center hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      {connector.type === 'AWS' && <Cloud className="h-5 w-5 text-orange-400" />}
                      {connector.type === 'GitHub' && <Share2 className="h-5 w-5 text-white" />}
                      {connector.type === 'Azure' && <Cloud className="h-5 w-5 text-blue-400" />}
                      {connector.type === 'GCP' && <Cloud className="h-5 w-5 text-red-400" />}
                      {connector.type === 'Okta' && <Shield className="h-5 w-5 text-indigo-400" />}
                    </div>
                    <div>
                      <p className="font-medium text-white">{connector.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{connector.type} • ID: {connector.id.substring(0, 8)}</p>
                    </div>
                  </div>
                  <div>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                      connector.status === 'Connected' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      connector.status === 'Error' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                      "bg-slate-500/10 text-slate-400 border-slate-500/20"
                    )}>
                      {connector.status}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-1000",
                            connector.health > 80 ? "bg-emerald-500" : connector.health > 50 ? "bg-yellow-500" : "bg-rose-500"
                          )}
                          style={{ width: `${connector.health}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-400">{connector.health}%</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {connector.lastScan}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-slate-400 hover:text-primary"
                      onClick={() => runAIScan(connector)}
                      disabled={isScanning === connector.id}
                    >
                      {isScanning === connector.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
                      onClick={() => handleDeleteConnector(connector.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Scan Results Expansion */}
                <AnimatePresence>
                  {scanResults[connector.id] && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/40 border-t border-white/5"
                    >
                      <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Zap className="h-4 w-4 text-yellow-400" />
                            AI Evidence Scan Results
                          </h3>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-slate-500"
                            onClick={() => setScanResults(prev => {
                              const next = { ...prev };
                              delete next[connector.id];
                              return next;
                            })}
                          >
                            Close
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {scanResults[connector.id].map((result, idx) => (
                            <div key={idx} className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">{result.control}</span>
                                <span className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                                  result.status === 'Pass' ? "bg-emerald-500/20 text-emerald-400" :
                                  result.status === 'Fail' ? "bg-rose-500/20 text-rose-400" :
                                  "bg-yellow-500/20 text-yellow-400"
                                )}>
                                  {result.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 italic">"{result.evidence}"</p>
                              <div className="pt-2 flex items-start gap-2">
                                <AlertCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                <p className="text-[11px] text-slate-300 leading-relaxed">{result.recommendation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Connector Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel max-w-lg w-full p-8 rounded-2xl border border-white/10 relative"
          >
            <h2 className="text-2xl font-bold text-white mb-2">Connect New Infrastructure</h2>
            <p className="text-slate-400 mb-8">Select a provider to start automated evidence collection.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { type: 'AWS', icon: Cloud, color: 'text-orange-400' },
                { type: 'GitHub', icon: Share2, color: 'text-white' },
                { type: 'Azure', icon: Cloud, color: 'text-blue-400' },
                { type: 'GCP', icon: Cloud, color: 'text-red-400' },
                { type: 'Okta', icon: Shield, color: 'text-indigo-400' },
              ].map((provider) => (
                <button
                  key={provider.type}
                  onClick={() => handleAddConnector(provider.type as any)}
                  className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all group"
                >
                  <provider.icon className={cn("h-10 w-10 mb-3 transition-transform group-hover:scale-110", provider.color)} />
                  <span className="font-medium text-white">{provider.type}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setShowAddModal(false)} className="text-slate-400">
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
