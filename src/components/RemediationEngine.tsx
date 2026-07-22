import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  User, 
  Plus, 
  Sparkles, 
  Trash2, 
  Loader2, 
  ShieldAlert, 
  Check, 
  FileText, 
  Calendar,
  AlertTriangle,
  X,
  Activity,
  CheckCircle,
  TrendingDown,
  Info,
  ExternalLink,
  ChevronRight,
  ClipboardCheck,
  Zap,
  CheckSquare
} from 'lucide-react';
import { RemediationService, RemediationTicket } from '../services/RemediationService';
import { useAuth } from '../lib/AuthContext';

// ==========================================
// 1. Remediation Card Component
// ==========================================
interface RemediationCardProps {
  ticket: RemediationTicket;
  onUpdateStatus: (id: string, status: RemediationTicket['status']) => void;
  onDeleteTicket: (id: string) => void;
  onSelect: (ticket: RemediationTicket) => void;
}

export function RemediationCard({ ticket, onUpdateStatus, onDeleteTicket, onSelect }: RemediationCardProps) {
  const severityColors = {
    Critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.06)]',
    High: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Medium: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    Low: 'bg-slate-500/10 text-slate-400 border-slate-500/10'
  };

  const statusActions: Record<RemediationTicket['status'], { next: RemediationTicket['status'] | null; label: string }> = {
    Backlog: { next: 'In Progress', label: 'Start Action' },
    'In Progress': { next: 'Resolved', label: 'Verify & Resolve' },
    Resolved: { next: 'Closed', label: 'Close Ticket' },
    Closed: { next: null, label: '' }
  };

  const currentAction = statusActions[ticket.status];

  return (
    <motion.div
      layoutId={`remediation-card-${ticket.id}`}
      className="p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_24px_-2px_rgba(99,102,241,0.08)] relative overflow-hidden group select-none"
    >
      {/* Decorative colored margin based on priority */}
      <div className={cn(
        "absolute top-0 left-0 bottom-0 w-[4px]",
        ticket.priority === 'High' ? 'bg-rose-500' :
        ticket.priority === 'Medium' ? 'bg-amber-500' : 'bg-indigo-500'
      )} />

      {/* Header section with severity level and trash */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={cn("text-[9px] uppercase tracking-wider font-bold py-0.5 px-2 font-mono", severityColors[ticket.severity])}>
            {ticket.severity} Impact
          </Badge>
          <Badge className="bg-white/[0.03] text-slate-300 border border-white/5 text-[9px] font-mono py-0.5 px-1.5 uppercase">
            {ticket.priority} Priority
          </Badge>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteTicket(ticket.id);
          }}
          className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-rose-400/80 hover:text-rose-400 transition-all cursor-pointer"
          title="Delete action plan"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Title & Short Description */}
      <div className="space-y-1.5 cursor-pointer" onClick={() => onSelect(ticket)}>
        <h5 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors tracking-tight line-clamp-1 leading-snug">
          {ticket.finding}
        </h5>
        <p className="text-[11px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
          {ticket.problem}
        </p>
      </div>

      {/* Due Date & Owner */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-slate-500 shrink-0" />
          <span>Due: </span>
          <span className="text-white/90">{ticket.dueDate}</span>
        </div>
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-slate-500 shrink-0" />
          <span className="text-slate-300 truncate max-w-[100px]">{ticket.ownerSuggestion}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          onClick={() => onSelect(ticket)}
          variant="outline"
          className="h-8 py-1 px-3 text-[10px] font-bold uppercase tracking-wider bg-white/[0.01] hover:bg-white/[0.04] border-white/5 hover:border-white/10 text-slate-300 hover:text-white cursor-pointer select-none"
        >
          Deep Audit View
          <ChevronRight className="h-3.5 w-3.5 ml-1 inline text-slate-500" />
        </Button>

        {currentAction.next && (
          <Button
            onClick={() => onUpdateStatus(ticket.id, currentAction.next!)}
            className="h-8 py-1 px-3 text-[10px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer select-none border-0 shadow-[0_2px_8px_rgba(99,102,241,0.2)]"
          >
            {currentAction.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ==========================================
// 2. Remediation Board Component (Kanban Grid)
// ==========================================
interface RemediationBoardProps {
  tickets: RemediationTicket[];
  onUpdateStatus: (id: string, status: RemediationTicket['status']) => void;
  onDeleteTicket: (id: string) => void;
  onSelect: (ticket: RemediationTicket) => void;
}

export function RemediationBoard({ tickets, onUpdateStatus, onDeleteTicket, onSelect }: RemediationBoardProps) {
  const columns: { id: RemediationTicket['status']; title: string; desc: string; textStyle: string; progressColor: string }[] = [
    { id: 'Backlog', title: 'Open & Backlog', desc: 'Identified compliance anomalies requiring immediate focus.', textStyle: 'text-rose-400', progressColor: 'bg-rose-500' },
    { id: 'In Progress', title: 'Under Active Fix', desc: 'Remediation protocols and patching under implementation.', textStyle: 'text-amber-400', progressColor: 'bg-amber-500' },
    { id: 'Resolved', title: 'Resolved & Verify', desc: 'Resolved issues awaiting validation and evidence logs check.', textStyle: 'text-emerald-400', progressColor: 'bg-emerald-500' },
    { id: 'Closed', title: 'Verification Closed', desc: 'Audited and verified compliant. Permanently closed.', textStyle: 'text-slate-400', progressColor: 'bg-indigo-500' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
      {columns.map((col) => {
        const colTickets = tickets.filter(t => t.status === col.id);
        return (
          <div key={col.id} className="p-4 rounded-2xl bg-slate-950/20 border border-white/5 space-y-4">
            {/* Column Header */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", col.progressColor)} />
                  <h4 className={cn("text-xs font-bold font-mono uppercase tracking-wide", col.textStyle)}>
                    {col.title}
                  </h4>
                </div>
                <Badge className="bg-white/5 text-slate-300 font-mono text-[9px] font-bold py-0.5 px-2 border-0">
                  {colTickets.length} Items
                </Badge>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal leading-snug">
                {col.desc}
              </p>
            </div>

            {/* Cards Listing inside column */}
            <div className="space-y-4 min-h-[420px] overflow-y-auto pr-0.5 max-h-[720px]">
              {colTickets.length === 0 ? (
                <div className="py-24 border border-dashed border-white/5 rounded-2xl text-center text-[11px] text-slate-600 font-sans italic flex flex-col items-center justify-center gap-2">
                  <CheckSquare className="h-5 w-5 text-slate-700" />
                  <span>Column is empty</span>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {colTickets.map((t) => (
                    <RemediationCard
                      key={t.id}
                      ticket={t}
                      onUpdateStatus={onUpdateStatus}
                      onDeleteTicket={onDeleteTicket}
                      onSelect={onSelect}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// 3. Remediation Timeline Component (Roadmap view)
// ==========================================
interface RemediationTimelineProps {
  tickets: RemediationTicket[];
  onSelect: (ticket: RemediationTicket) => void;
}

export function RemediationTimeline({ tickets, onSelect }: RemediationTimelineProps) {
  if (tickets.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl text-slate-500 text-xs">
        No active remediation actions are currently tracked physically on the roadmap timeline.
      </div>
    );
  }

  // Sort tickets by due date
  const sortedTickets = [...tickets].sort((a,b) => {
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4 relative">
      {/* Central progress vertical lineage wire */}
      <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-[1px] bg-slate-800" />

      {sortedTickets.map((item, index) => {
        const isLeft = index % 2 === 0;
        const isCritical = item.severity === 'Critical' || item.severity === 'High';

        return (
          <div key={item.id} className="relative flex flex-col md:flex-row md:justify-between items-start md:items-center w-full group">
            
            {/* Roadmap Circle pointer */}
            <div className={cn(
              "absolute left-2.5 md:left-1/2 -translate-x-[6px] h-3 w-3 rounded-full border-2 bg-slate-950 transition-all z-10 duration-300",
              item.status === 'Closed' ? 'border-indigo-400 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' :
              item.status === 'Resolved' ? 'border-emerald-400 bg-emerald-500' :
              isCritical ? 'border-rose-500 animate-pulse' : 'border-amber-400'
            )} />

            {/* Card block alignment wrapper */}
            <div className={cn(
              "w-full md:w-[45%] pl-10 md:pl-0",
              isLeft ? "md:mr-auto text-left" : "md:ml-auto md:text-left"
            )}>
              <motion.div
                whileHover={{ y: -3 }}
                onClick={() => onSelect(item)}
                className={cn(
                  "p-5 rounded-2xl border transition-all cursor-pointer space-y-3.5 bg-slate-950/40 hover:bg-slate-900",
                  item.status === 'Closed' ? 'border-slate-800/40 opacity-70' :
                  isCritical ? 'border-rose-500/10 hover:border-rose-500/30' : 'border-white/5 hover:border-indigo-500/20'
                )}
              >
                {/* Heading line */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-indigo-400 shrink-0" />
                    <span className="text-[10px] font-mono text-indigo-300 font-bold tracking-wider">
                      {item.dueDate}
                    </span>
                  </div>
                  <Badge className={cn(
                    "text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono",
                    item.status === 'Closed' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/10' :
                    item.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    item.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  )}>
                    {item.status}
                  </Badge>
                </div>

                {/* Body Content */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {item.finding}
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                    {item.problem}
                  </p>
                </div>

                {/* Sub audit check indicators */}
                <div className="flex items-center gap-3 pt-2 border-t border-white/5 text-[9px] font-mono text-slate-500">
                  <span className="text-slate-400 uppercase">SUGGESTED OWNER: {item.ownerSuggestion}</span>
                </div>
              </motion.div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// 4. Main RemediationEngine Workspace tab controller
// ==========================================
interface RemediationEngineProps {
  vendorId: string;
  vendorName: string;
  originalFindings: { finding: string; recommendation: string }[];
  onTicketCreated?: () => void;
}

export function RemediationEngine({ vendorId, vendorName, originalFindings, onTicketCreated }: RemediationEngineProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'board' | 'timeline' | 'add_finding'>('board');
  const [tickets, setTickets] = useState<RemediationTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedTicket, setSelectedTicket] = useState<RemediationTicket | null>(null);

  // Quick draft fields
  const [newFindingText, setNewFindingText] = useState<string>('');
  const [customRecommendation, setCustomRecommendation] = useState<string>('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string>('');

  // Evidence upload placeholder details
  const [uploadedEvidenceText, setUploadedEvidenceText] = useState<string>('');
  const [isUploadingEvidence, setIsUploadingEvidence] = useState<boolean>(false);
  const [evidenceLogSuccess, setEvidenceLogSuccess] = useState<string>('');

  // Load tickets on mount & update
  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const orgId = profile?.organizationId || '';
      const dbTickets = await RemediationService.getTicketsByVendor(vendorId, orgId);
      setTickets(dbTickets);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId && profile?.organizationId) {
      loadTickets();
    }
  }, [vendorId, profile?.organizationId]);

  // Seed default items if workspace database is clear
  const handleSeedDefaults = async () => {
    setIsLoading(true);
    try {
      // Create beautifully populated mock plans
      const initialSeedFindings = originalFindings.length > 0 ? originalFindings : [
        {
          finding: 'Critical: Incomplete MFA enforcement on active administrative endpoints',
          recommendation: 'De-provision un-enforced subkey systems and require mandatory identity provider (IDP) dual-factor check ins for all routes.'
        },
        {
          finding: 'High: Unverified offshore subcontractor queries of sensitive customer telemetry',
          recommendation: 'Isolate subnet access configurations and acquire bridging subcontractor compliance attestations.'
        }
      ];

      for (const item of initialSeedFindings) {
        // Fetch plan using server APi mock/real AI
        const generated = await RemediationService.generateAIPlan(item.finding, item.recommendation, vendorName);
        await RemediationService.createTicket({
          vendorId,
          vendorName,
          ...generated,
          status: 'Backlog',
          createdAt: new Date().toISOString(),
          organizationId: profile?.organizationId || ''
        });
      }

      await loadTickets();
      if (onTicketCreated) onTicketCreated();
    } catch (err) {
      console.error("Seeding error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert compliance finding on the fly in 1-click
  const handleDirectOneClickCreation = async (finding: string, recommendation: string) => {
    setIsLoading(true);
    try {
      const generated = await RemediationService.generateAIPlan(finding, recommendation, vendorName);
      const newTicket = await RemediationService.createTicket({
        vendorId,
        vendorName,
        ...generated,
        status: 'Backlog',
        createdAt: new Date().toISOString(),
        organizationId: profile?.organizationId || ''
      });
      // Append local
      setTickets(prev => [newTicket, ...prev]);
      setActiveTab('board');
      setSelectedTicket(newTicket);
      if (onTicketCreated) onTicketCreated();
    } catch (err) {
      console.error("One-click conversion failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Status promotes
  const handleUpdateStatus = async (id: string, newStatus: RemediationTicket['status']) => {
    try {
      await RemediationService.updateTicketStatus(id, newStatus);
      // Update local state smoothly
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      
      // Update modal selected ticket if matches
      if (selectedTicket?.id === id) {
        setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Ticket deletes
  const handleDeleteTicket = async (id: string) => {
    try {
      await RemediationService.deleteTicket(id);
      setTickets(prev => prev.filter(t => t.id !== id));
      if (selectedTicket?.id === id) {
        setSelectedTicket(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Custom design-driven submitter with AI engine help
  const handleCompileAIActionPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFindingText.trim()) {
      setGenerationError("Finding text statement or description cannot be empty.");
      return;
    }

    setIsGeneratingPlan(true);
    setGenerationError('');
    try {
      const resultPlan = await RemediationService.generateAIPlan(newFindingText, customRecommendation, vendorName);
      
      const createdTicket = await RemediationService.createTicket({
        vendorId,
        vendorName,
        ...resultPlan,
        status: 'Backlog',
        createdAt: new Date().toISOString(),
        organizationId: profile?.organizationId || ''
      });

      setTickets(prev => [createdTicket, ...prev]);
      setNewFindingText('');
      setCustomRecommendation('');
      setActiveTab('board');
      setSelectedTicket(createdTicket);
      
      if (onTicketCreated) onTicketCreated();
    } catch (err: any) {
      setGenerationError(err.message || "Guardentra AI encountered a GRC error compiling details.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Resolving ticket with uploaded compliance evidence artifact link
  const handleAuditVerificationSubmit = async (ticketId: string) => {
    if (!uploadedEvidenceText.trim()) return;
    setIsUploadingEvidence(true);
    setEvidenceLogSuccess('');

    try {
      // Simulate/save verification evidence logs to GRC records
      await RemediationService.updateTicket(ticketId, {
        requiredEvidence: `${selectedTicket?.requiredEvidence || ''} [AUDITED VERIFIED: ${uploadedEvidenceText}]`,
        status: 'Resolved'
      });

      // Update local
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'Resolved' } : t));
      if (selectedTicket) {
        setSelectedTicket(prev => prev ? { ...prev, status: 'Resolved' } : null);
      }
      setEvidenceLogSuccess('Compliance attestation log documented successfully! Status elevated to Resolved (Pending Auditor Closing verification).');
      setUploadedEvidenceText('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation header desk */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Button
            onClick={() => setActiveTab('board')}
            variant="outline"
            className={cn(
              "h-9 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer border-0 select-none",
              activeTab === 'board' ? "bg-indigo-600/10 text-indigo-400" : "bg-transparent text-slate-400 hover:text-white"
            )}
          >
            <CheckSquare className="h-4 w-4 mr-1.5" />
            Remediation Board
          </Button>

          <Button
            onClick={() => setActiveTab('timeline')}
            variant="outline"
            className={cn(
              "h-9 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer border-0 select-none",
              activeTab === 'timeline' ? "bg-indigo-600/10 text-indigo-400" : "bg-transparent text-slate-400 hover:text-white"
            )}
          >
            <Activity className="h-4 w-4 mr-1.5" />
            Milestone Timeline
          </Button>

          <Button
            onClick={() => setActiveTab('add_finding')}
            variant="outline"
            className={cn(
              "h-9 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer border-0 select-none",
              activeTab === 'add_finding' ? "bg-indigo-600/10 text-indigo-400" : "bg-transparent text-slate-400 hover:text-white"
            )}
          >
            <Plus className="h-4 w-4 mr-1.5 text-indigo-400" />
            AI Playbook Writer
          </Button>
        </div>

        {/* Quick Seeding Desk */}
        {tickets.length === 0 && !isLoading && (
          <Button
            onClick={handleSeedDefaults}
            className="h-9 px-4 border border-dashed border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-wider animate-pulse hover:animate-none cursor-pointer"
          >
            <Sparkles className="h-4 w-4 mr-2 text-yellow-300" />
            Seed AI Playbook Remediation Plans
          </Button>
        )}
      </div>

      {/* Main Tab content loading state wrapper */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <span className="text-xs font-mono">Synchronizing GRC Remediation Records...</span>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Active outstanding compliance indicator banner */}
          {tickets.some(t => t.status !== 'Closed') && activeTab !== 'add_finding' && (
            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 text-orange-400/90 text-xs flex items-center justify-between flex-wrap gap-4 select-none">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-4.5 w-4.5 text-orange-400 shrink-0" />
                <span>
                  <strong>Compliance Warning:</strong> outstanding security risks remain unmitigated. Review the active timeline and fix problems to raise Trust score.
                </span>
              </div>
              <Badge className="bg-orange-500/15 text-orange-300 border-0 font-mono text-[9px] font-bold uppercase">
                {tickets.filter(t => t.status !== 'Closed').length} Risks Left
              </Badge>
            </div>
          )}

          {/* BOARD VIEW */}
          {activeTab === 'board' && (
            <RemediationBoard
              tickets={tickets}
              onUpdateStatus={handleUpdateStatus}
              onDeleteTicket={handleDeleteTicket}
              onSelect={setSelectedTicket}
            />
          )}

          {/* TIMELINE VIEW */}
          {activeTab === 'timeline' && (
            <RemediationTimeline
              tickets={tickets}
              onSelect={setSelectedTicket}
            />
          )}

          {/* AI PLAYBOOK WRITER VIEW */}
          {activeTab === 'add_finding' && (
            <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-slate-950/40 border border-white/5 space-y-6">
              <div>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block font-mono">Dynamic Compliance Mitigator</span>
                <h3 className="text-base font-bold text-white mt-1">Deploy New AI-Driven Remediation Task</h3>
                <p className="text-xs text-slate-400 mt-0.5 leading-normal leading-relaxed">
                  Enter any compliance gap, audit objection, or security finding. Guardentra AI will generate a complete structural correction plan with precise deadlines, success metrics, and required proof objectives.
                </p>
              </div>

              <form onSubmit={handleCompileAIActionPlan} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-mono font-bold uppercase block">
                    Security Exception or Finding Description
                  </label>
                  <Input
                    required
                    value={newFindingText}
                    onChange={(e) => setNewFindingText(e.target.value)}
                    placeholder="e.g., Unencrypted S3 buckets, missing de-provisioning records, stale AWS root keys..."
                    className="w-full text-xs text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-mono font-bold uppercase block">
                    Known Recommendations or Context (Optional)
                  </label>
                  <textarea
                    value={customRecommendation}
                    onChange={(e) => setCustomRecommendation(e.target.value)}
                    placeholder="Provide any known context or suggested actions for the AI to enrich..."
                    className="w-full h-24 rounded-lg bg-slate-900 border border-white/5 p-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 resize-none"
                  />
                </div>

                {generationError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{generationError}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={isGeneratingPlan}
                    className="w-full sm:w-auto h-10 px-6 font-bold uppercase tracking-wider text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg disabled:opacity-50 select-none cursor-pointer"
                  >
                    {isGeneratingPlan ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Prescriptive Fix via AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 text-yellow-300" />
                        Generate AI Remediation Plan
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Original compliance findings list for easy 1-click conversion */}
              {originalFindings.length > 0 && (
                <div className="pt-6 border-t border-white/5 space-y-3.5">
                  <h4 className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
                    Unresolved GRC Findings Available for 1-Click Mitigation
                  </h4>
                  <div className="space-y-2.5">
                    {originalFindings.map((findingItem, i) => (
                      <div key={i} className="p-4 rounded-xl bg-rose-500/[0.02] border border-rose-500/10 hover:border-indigo-500/20 transition-colors flex justify-between items-center flex-wrap gap-4">
                        <div className="flex-1 min-w-[240px] space-y-1">
                          <span className="text-xs font-bold text-white block">
                            {findingItem.finding}
                          </span>
                          <span className="text-[11px] text-slate-400 block line-clamp-1">
                            Recommendation: {findingItem.recommendation}
                          </span>
                        </div>
                        <Button
                          onClick={() => handleDirectOneClickCreation(findingItem.finding, findingItem.recommendation)}
                          className="h-8 text-[10px] uppercase font-bold bg-indigo-500/10 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer border border-indigo-500/20"
                        >
                          1-Click Remediation Task
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DETAILED MODAL VIEWER: Renders Problem, Impact, Recommended Action, Deadline, Success Criteria */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-[0_10px_50px_-10px_rgba(0,0,0,0.8)]"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 bg-slate-900/40 flex justify-between items-start gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] uppercase tracking-wider font-bold">
                      {selectedTicket.severity} Severity
                    </Badge>
                    <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] uppercase tracking-wider font-bold">
                      Priority: {selectedTicket.priority}
                    </Badge>
                    <Badge className="bg-white/5 text-slate-300 text-[9px] font-mono border-0 uppercase">
                      Status: {selectedTicket.status}
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                    {selectedTicket.finding}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedTicket(null);
                    setEvidenceLogSuccess('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Body Details Grid  (Satisfying "Problem", "Impact", "Recommended Action", "Deadline", "Success Criteria" view requirements) */}
              <div className="p-6 space-y-6 max-h-[520px] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Column Schema Cards */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                      <h4 className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        Problem Statement
                      </h4>
                      <p className="text-xs text-slate-300 leading-normal">
                        {selectedTicket.problem}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                      <h4 className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                        Business Impact
                      </h4>
                      <p className="text-xs text-slate-300 leading-normal">
                        {selectedTicket.businessImpact || selectedTicket.impact}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                      <h4 className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Recommended Corrective Action
                      </h4>
                      <p className="text-xs text-slate-300 leading-normal">
                        {selectedTicket.recommendedAction || selectedTicket.recommendedFix}
                      </p>
                    </div>
                  </div>

                  {/* Right Column Specifications Cards */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
                      <div className="flex justify-between text-[11px] font-mono text-slate-400 border-b border-white/5 pb-1.5">
                        <span>SUGGESTED OWNER</span>
                        <strong className="text-white font-medium">{selectedTicket.ownerSuggestion}</strong>
                      </div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-400 border-b border-white/5 pb-1.5">
                        <span>MITIGATION DEADLINE</span>
                        <strong className="text-white">{selectedTicket.deadline || selectedTicket.dueDate}</strong>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                      <h4 className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Success Verification Criteria
                      </h4>
                      <p className="text-xs text-slate-300 leading-normal">
                        {selectedTicket.successCriteria}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                      <h4 className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        Required Compliance Evidence
                      </h4>
                      <p className="text-xs text-slate-400 leading-normal font-sans text-[11px] leading-snug">
                        {selectedTicket.requiredEvidence}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit evidence attestation form for unresolved tickets */}
                {selectedTicket.status !== 'Closed' && selectedTicket.status !== 'Resolved' && (
                  <div className="p-5 rounded-xl bg-indigo-600/[0.02] border border-indigo-500/10 space-y-3 pt-4">
                    <div>
                      <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                        Step 3: Document Compliance Evidence Check-in
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                        Provide evidence logs, configuration files, or policy signoff details verifying that this mitigation is actively operational.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={uploadedEvidenceText}
                        onChange={(e) => setUploadedEvidenceText(e.target.value)}
                        placeholder="Paste your compliance console outputs, AWS KMS alias encryption verification logs, or file link here..."
                        className="flex-1 text-xs text-white"
                      />
                      <Button
                        onClick={() => handleAuditVerificationSubmit(selectedTicket.id)}
                        disabled={isUploadingEvidence || !uploadedEvidenceText.trim()}
                        className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold uppercase tracking-wider text-white"
                      >
                        {isUploadingEvidence ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log Evidence'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Evidence log success message */}
                {evidenceLogSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle className="h-4.5 w-4.5 shrink-0" />
                    <span>{evidenceLogSuccess}</span>
                  </div>
                )}
              </div>

              {/* Footer action logs */}
              <div className="p-4 border-t border-white/5 bg-slate-900/30 flex justify-between items-center text-[11px]">
                <span className="text-slate-500 uppercase font-mono">PARTNER: {selectedTicket.vendorName}</span>
                {selectedTicket.status !== 'Closed' && (
                  <div className="flex gap-2">
                    {selectedTicket.status !== 'Resolved' && (
                      <Button
                        onClick={() => handleUpdateStatus(selectedTicket.id, 'Resolved')}
                        className="h-8 px-3 text-[10px] font-bold uppercase bg-amber-600 hover:bg-amber-500 text-white"
                      >
                        Elevate to Verify
                      </Button>
                    )}
                    <Button
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'Closed')}
                      className="h-8 px-3 text-[10px] font-bold uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                    >
                      Audit & Close Ticket
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
