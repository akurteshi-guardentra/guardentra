import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  ShieldCheck, 
  FileText, 
  Zap, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Plus, 
  Sparkles, 
  RotateCw,
  TrendingUp,
  Shield,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

// Types for handleFirestoreError
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Interface for unified feed items
export interface ActivityItem {
  id: string;
  module: 'Compliance' | 'Policy' | 'Remediation' | 'Risk';
  title: string;
  description: string;
  timestamp: string; // ISO string or Date representation
  status?: string;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  progress?: number;
  category?: string;
}

export function ActivityFeed() {
  const { profile, loading } = useAuth();
  const [filter, setFilter] = useState<'All' | 'Compliance' | 'Policy' | 'Remediation' | 'Risk'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickLog, setShowQuickLog] = useState(false);
  
  // Real-time states
  const [complianceItems, setComplianceItems] = useState<ActivityItem[]>([]);
  const [policyItems, setPolicyItems] = useState<ActivityItem[]>([]);
  const [remediationItems, setRemediationItems] = useState<ActivityItem[]>([]);
  const [riskItems, setRiskItems] = useState<ActivityItem[]>([]);
  const [isSubscribing, setIsSubscribing] = useState(true);

  // States for Quick Log action
  const [logType, setLogType] = useState<'compliance' | 'policy' | 'remediation'>('policy');
  const [logTitle, setLogTitle] = useState('');
  const [logCategory, setLogCategory] = useState('Security Operations');
  const [logExtra, setLogExtra] = useState(''); // e.g. status, severity, progress
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!profile?.organizationId) {
      setIsSubscribing(false);
      return;
    }

    const orgId = profile.organizationId;
    setIsSubscribing(true);

    // 1. Listen to real-time COMPLIANCE updates
    const qCompliance = query(
      collection(db, 'compliance'),
      where('organizationId', '==', orgId)
    );
    const unsubCompliance = onSnapshot(qCompliance, (snapshot) => {
      const items: ActivityItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          module: 'Compliance',
          title: data.name || 'Framework Update',
          description: `Compliance status: ${data.status || 'Not Started'} (Progress: ${data.progress || 0}%)`,
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          status: data.status,
          progress: data.progress,
        });
      });
      setComplianceItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'compliance');
    });

    // 2. Listen to real-time POLICIES updates
    const qPolicies = query(
      collection(db, 'policies'),
      where('organizationId', '==', orgId)
    );
    const unsubPolicies = onSnapshot(qPolicies, (snapshot) => {
      const items: ActivityItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          module: 'Policy',
          title: data.title || 'Draft Policy',
          description: `Policy ${data.version || '1.0'} status changed to ${data.status || 'Draft'} (${data.category || 'General'})`,
          timestamp: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : 
                     data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.updatedAt || data.createdAt || new Date().toISOString()),
          status: data.status,
          category: data.category,
        });
      });
      setPolicyItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'policies');
    });

    // 3. Listen to real-time REMEDIATIONS updates
    const qRemediations = query(
      collection(db, 'remediations'),
      where('organizationId', '==', orgId)
    );
    const unsubRemediations = onSnapshot(qRemediations, (snapshot) => {
      const items: ActivityItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          module: 'Remediation',
          title: `Vendor Remediation: ${data.vendorName || 'Unknown Vendor'}`,
          description: `Mitigation on finding "${data.finding || 'N/A'}" set to status: ${data.status || 'In Progress'}`,
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          status: data.status,
          severity: data.severity,
        });
      });
      setRemediationItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'remediations');
    });

    // 4. Listen to real-time RISKS updates
    const qRisks = query(
      collection(db, 'risks'),
      where('organizationId', '==', orgId)
    );
    const unsubRisks = onSnapshot(qRisks, (snapshot) => {
      const items: ActivityItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          module: 'Risk',
          title: data.title || 'Identified Issue',
          description: `Risk mitigation status logged as "${data.status || 'Open'}" with severity: ${data.severity || 'Medium'}`,
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          status: data.status,
          severity: data.severity,
          category: data.category,
        });
      });
      setRiskItems(items);
      setIsSubscribing(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'risks');
    });

    return () => {
      unsubCompliance();
      unsubPolicies();
      unsubRemediations();
      unsubRisks();
    };
  }, [profile?.organizationId, loading]);

  // Combine and sort activities dynamically
  const combinedActivities: ActivityItem[] = [
    ...complianceItems,
    ...policyItems,
    ...remediationItems,
    ...riskItems,
  ].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Filter activities based on module & search queries
  const filteredActivities = combinedActivities.filter((item) => {
    const matchesFilter = filter === 'All' || item.module === filter;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.status && item.status.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Helper for computing relative time
  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const differenceInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (differenceInSeconds < 5) return 'Just now';
      if (differenceInSeconds < 60) return `${differenceInSeconds}s ago`;
      
      const differenceInMinutes = Math.floor(differenceInSeconds / 60);
      if (differenceInMinutes < 60) return `${differenceInMinutes}m ago`;
      
      const differenceInHours = Math.floor(differenceInMinutes / 60);
      if (differenceInHours < 24) return `${differenceInHours}h ago`;
      
      const differenceInDays = Math.floor(differenceInHours / 24);
      if (differenceInDays === 1) return 'Yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Active';
    }
  };

  // Quick Action: Write a new Security/Compliance payload directly to Firestore to verify real-time listening
  const handleQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTitle.trim() || !profile?.organizationId) return;

    setIsLogging(true);
    try {
      if (logType === 'policy') {
        const payload = {
          title: logTitle.trim(),
          content: `# ${logTitle.trim()}\n\nGenerated via real-time Feed quick logger.`,
          category: logCategory,
          status: (logExtra || 'Draft') as 'Draft' | 'Active' | 'Archived',
          version: '1.0',
          organizationId: profile.organizationId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'policies'), payload);
      } else if (logType === 'compliance') {
        const payload = {
          name: logTitle.trim(),
          description: `Custom compliance standard added dynamically.`,
          progress: parseInt(logExtra) || 10,
          status: parseInt(logExtra) >= 100 ? 'Compliant' : 'In Progress',
          nextAudit: new Date(Date.now() + 86400000 * 90).toISOString().split('T')[0],
          organizationId: profile.organizationId,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'compliance'), payload);
      } else if (logType === 'remediation') {
        const payload = {
          vendorId: 'quick-log-vendor',
          vendorName: 'Internal Ops Dev',
          finding: logTitle.trim(),
          status: (logExtra || 'In Progress') as 'Backlog' | 'In Progress' | 'Resolved' | 'Closed',
          severity: 'High' as const,
          businessImpact: 'Operational efficiency & regulatory friction.',
          recommendedFix: 'Review access rules as per ISO Annex A.12.',
          priority: 'High' as const,
          dueDate: new Date(Date.now() + 86400000 * 14).toISOString(),
          ownerSuggestion: 'Security Coordinator',
          requiredEvidence: 'Access lists, signature logs',
          problem: 'Direct unvalidated updates bypass controls',
          impact: 'Potential logic breaches',
          recommendedAction: 'Inject localized middleware filters',
          deadline: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
          successCriteria: 'No shadow writes logged',
          organizationId: profile.organizationId,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'remediations'), payload);
      }

      setLogTitle('');
      setLogExtra('');
      setShowQuickLog(false);
    } catch (err) {
      console.error("Failed to append custom security event:", err);
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-white/5 relative overflow-hidden" id="dashboard-activity-feed-card">
      <div className="absolute top-0 right-0 p-3 flex items-center gap-1.5 z-10">
        <div className={cn(
          "h-2 w-2 rounded-full",
          isSubscribing ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"
        )} />
        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider font-mono">
          {isSubscribing ? 'Syncing...' : 'Stream: Live'}
        </span>
      </div>

      <CardHeader className="pb-3 border-b border-white/[0.03]">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2 font-display">
              <Zap className="h-4.5 w-4.5 text-indigo-400" />
              GRC Operational Feed
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              Live Firestore event synchronization on Compliances, Policies, and Mitigations.
            </CardDescription>
          </div>
          
          <Button 
            onClick={() => {
              setLogTitle('');
              setShowQuickLog(!showQuickLog);
            }}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto text-[10px] uppercase tracking-wider font-bold h-8 border-indigo-500/20 bg-indigo-500/5 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Quick Event Log
          </Button>
        </div>

        {/* Quick Log Form */}
        <AnimatePresence>
          {showQuickLog && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleQuickLog}
              className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-indigo-500/10 space-y-3 overflow-hidden text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/[0.03]">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5 text-indigo-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  Trigger Test Event
                </h4>
                <button 
                  type="button" 
                  onClick={() => setShowQuickLog(false)}
                  className="text-slate-500 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Item Type</label>
                  <select 
                    value={logType}
                    onChange={(e) => {
                      setLogType(e.target.value as any);
                      setLogExtra('');
                    }}
                    className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="policy">Policy Update</option>
                    <option value="compliance">Compliance Event</option>
                    <option value="remediation">Mitigation Action</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Title / Action Details</label>
                  <input 
                    type="text"
                    required
                    maxLength={100}
                    placeholder={
                      logType === 'policy' ? "e.g., Access Control Policy" :
                      logType === 'compliance' ? "e.g., ISO 27001 Audit Run" : "e.g., Fixed open API server endpoints"
                    }
                    value={logTitle}
                    onChange={(e) => setLogTitle(e.target.value)}
                    className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {logType === 'policy' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
                    <input 
                      type="text"
                      placeholder="e.g., Network Security"
                      value={logCategory}
                      onChange={(e) => setLogCategory(e.target.value)}
                      className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                    <select 
                      value={logExtra || 'Draft'}
                      onChange={(e) => setLogExtra(e.target.value)}
                      className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Active">Active</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                </div>
              )}

              {logType === 'compliance' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Progress %</label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g., 90"
                    value={logExtra}
                    onChange={(e) => setLogExtra(e.target.value)}
                    className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
                  />
                </div>
              )}

              {logType === 'remediation' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Ticket Status</label>
                  <select 
                    value={logExtra || 'In Progress'}
                    onChange={(e) => setLogExtra(e.target.value)}
                    className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
                  >
                    <option value="Backlog">Backlog</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowQuickLog(false)}
                  className="text-xs text-slate-400 h-8"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={isLogging}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 font-bold px-4"
                >
                  {isLogging ? 'Logging...' : 'Publish to Firestore'}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch mb-5">
          {/* Filtering Tabs */}
          <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-white/[0.03] self-start">
            {(['All', 'Compliance', 'Policy', 'Remediation', 'Risk'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all",
                  filter === tab 
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-md shadow-indigo-500/5" 
                    : "text-slate-400 hover:text-white border border-transparent"
                )}
              >
                {tab === 'All' ? 'Complete Stream' : tab + 's'}
              </button>
            ))}
          </div>

          {/* Search Field */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search feed telemetry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Feed List */}
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {filteredActivities.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 border border-dashed border-white/[0.03] rounded-xl text-center text-slate-500 text-xs italic flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2 bg-white/[0.01] rounded-full text-slate-600">
                  <Filter className="h-5 w-5" />
                </div>
                <span>No activities found matching criteria.</span>
                <span className="text-[10px] text-slate-600">Try creating a test event using the logger above!</span>
              </motion.div>
            ) : (
              filteredActivities.map((activity) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                  className="flex items-start sm:items-center justify-between p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/10 hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-start sm:items-center gap-3.5 text-left">
                    {/* Icon Column */}
                    <div className={cn(
                      "p-2.25 rounded-xl flex items-center justify-center shrink-0 shadow-lg",
                      activity.module === 'Compliance' ? "bg-emerald-500/5 border border-emerald-500/20 text-emerald-400" :
                      activity.module === 'Policy' ? "bg-cyan-500/5 border border-cyan-500/20 text-cyan-400" :
                      activity.module === 'Remediation' ? "bg-amber-500/5 border border-amber-500/20 text-amber-400" :
                      "bg-rose-500/5 border border-rose-500/20 text-rose-400"
                    )}>
                      {activity.module === 'Compliance' && <ShieldCheck className="h-4.5 w-4.5" />}
                      {activity.module === 'Policy' && <FileText className="h-4.5 w-4.5" />}
                      {activity.module === 'Remediation' && <Shield className="h-4.5 w-4.5" />}
                      {activity.module === 'Risk' && <AlertTriangle className="h-4.5 w-4.5" />}
                    </div>

                    {/* Metadata Content */}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <h4 className="text-sm font-bold text-slate-200">
                          {activity.title}
                        </h4>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider shrink-0",
                          activity.module === 'Compliance' ? "bg-emerald-500/10 text-emerald-400/90" :
                          activity.module === 'Policy' ? "bg-cyan-500/10 text-cyan-400/90" :
                          activity.module === 'Remediation' ? "bg-amber-500/10 text-amber-400/90" :
                          "bg-rose-500/10 text-rose-400/90"
                        )}>
                          {activity.module}
                        </span>
                        
                        {activity.status && (
                          <span className="text-[9px] bg-slate-950 border border-white/5 text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">
                            {activity.status}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {activity.description}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-1 sm:hidden">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span className="text-[10px] font-mono text-slate-500">
                          {getRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp & Inspect Actions */}
                  <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0 pl-4 text-right">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-slate-600" />
                      <span className="text-[11px] font-mono font-medium">
                        {getRelativeTime(activity.timestamp)}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const routes: Record<string, string> = {
                          'Compliance': '/compliance',
                          'Policy': '/policies',
                          'Remediation': '/vendor-risk', // remediations are managed in vendor-risk dashboard
                          'Risk': '/risks'
                        };
                        window.location.href = routes[activity.module] || '/';
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#6366f1] hover:text-[#8b5cf6] p-0 h-auto hover:bg-transparent"
                    >
                      Inspect →
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
