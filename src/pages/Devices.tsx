import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  Laptop, 
  Smartphone, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Monitor,
  HardDrive,
  Lock,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion } from 'framer-motion';
import { cn } from '@/src/lib/utils';
import { Badge } from '../components/ui/badge';

interface Device {
  id: string;
  ownerName: string;
  ownerEmail: string;
  deviceName: string;
  os: 'macOS' | 'Windows' | 'iOS' | 'Android';
  version: string;
  lastSeen: string;
  isEncrypted: boolean;
  hasAntivirus: boolean;
  isMfaActive: boolean;
  healthScore: number;
  organizationId: string;
}

export function IdentityAccess() {
  const { profile, loading } = useAuth();
  const [identities, setIdentities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Enhanced Identity Data: Linking Device Health to Data Access Sensitivity
  useEffect(() => {
    if (loading || !profile?.organizationId) return;

    const q = query(
      collection(db, 'identities'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setIdentities(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId, loading]);

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-rose-400';
  };

  const filteredDevices = identities.filter(d => 
    (d.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (d.device?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display text-glow">
            Identity Risk Surface
          </h1>
          <p className="text-slate-400 mt-1">
            Correlating user access permissions with real-time endpoint integrity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Search devices or owners..." 
              className="pl-10 w-64 bg-black/20 border-white/10 text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="border-white/10 text-slate-300">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white">
            <RefreshCw className="h-4 w-4 mr-2" />
            Force Re-Scan
          </Button>
        </div>
      </div>

      {/* Aggregate Score Card - Inspiration from Cybee */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 glass-panel p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden bg-gradient-to-br from-indigo-900/20 to-purple-900/10">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-4">Identity Resilience Quotient</p>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="rgba(255,255,255,0.05)" 
                strokeWidth="8" 
              />
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="8" 
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * (identities.length ? identities.reduce((acc, d) => acc + d.deviceHealth, 0) / identities.length : 0)) / 100}
                className="text-primary"
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <span className="absolute text-3xl font-bold text-white tracking-tighter">
              {identities.length ? Math.round(identities.reduce((acc, d) => acc + d.deviceHealth, 0) / identities.length) : 0}%
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 leading-tight">
            Measuring the structural integrity of your team's access map.
          </p>
        </div>

        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: 'High Priority Assets', value: `${identities.filter(d => d.riskScore > 50).length}`, icon: Lock, color: 'text-indigo-400' },
            { label: 'Access Resilience', value: `${Math.round(identities.filter(d => d.deviceHealth >= 80).length / (identities.length || 1) * 100)}%`, icon: ShieldCheck, color: 'text-emerald-400' },
            { label: 'Security Debt', value: identities.filter(d => d.deviceHealth < 70).length, icon: ShieldAlert, color: 'text-rose-400' },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <stat.icon className="h-10 w-10" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className={cn("text-3xl font-bold mt-2", stat.color)}>{stat.value}</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full", stat.color.replace('text', 'bg'))} 
                    style={{ width: `${(identities.length ? identities.filter(d => d.deviceHealth >= 90).length / identities.length : 0) * 100}%` }} 
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Device List */}
      <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden">
        <div className="grid grid-cols-12 p-5 bg-white/[0.02] border-b border-white/5">
          <div className="col-span-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Employee & Device</div>
          <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Platform</div>
          <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Encryption</div>
          <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Threat Protection</div>
          <div className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Score</div>
          <div className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Actions</div>
        </div>

        <div className="divide-y divide-white/[0.03]">
          {filteredDevices.map((device) => (
            <div key={device.id} className="grid grid-cols-12 p-5 items-center hover:bg-white/[0.01] transition-colors group">
              <div className="col-span-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                  {device.name?.charAt(0) || '?'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{device.name}</h4>
                  <p className="text-[10px] text-slate-500 font-mono tracking-tight">{device.accessLevel} • {device.dataSensitivity}</p>
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Laptop className="h-4 w-4 text-white" />
                <span className="text-xs text-slate-300 font-mono">{device.device}</span>
              </div>
              <div className="col-span-2 flex justify-center">
                {device.deviceHealth >= 80 ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 sm:px-3">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    TRUSTED
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-rose-400 border-rose-500/20 gap-1 bg-rose-500/5">
                    <ShieldAlert className="h-2.5 w-2.5" />
                    COMPROMISED
                  </Badge>
                )}
              </div>
              <div className="col-span-2 flex justify-center text-center">
                <div className={cn(
                  "text-[10px] px-2 py-1 rounded font-bold",
                  device.riskScore > 50 ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                )}>
                  {device.riskScore > 50 ? 'HIGH COLLATERAL' : 'LOW SURFACE'}
                </div>
              </div>
              <div className="col-span-1 flex justify-center">
                <span className={cn("font-mono font-bold text-sm", getHealthColor(device.deviceHealth))}>
                  {device.deviceHealth}%
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 group-hover:text-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Invisible Shield Real-time Telemetry Overlay Simulation */}
      <div className="p-4 rounded-xl bg-black/40 border border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
            Guardentra Intelligence Engine: Monitoring Fleet Integrity ... 
          </span>
          <span className="text-[10px] font-mono text-primary animate-pulse">
            [VERIFYING FILEVAULT] [VERIFYING CROWDSTRIKE] [CHECKING WIPEOUT CAPABILITIES]
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-600">
          Last Global Scan: Just Now
        </div>
      </div>
    </div>
  );
}
