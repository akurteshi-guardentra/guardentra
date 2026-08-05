import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Zap,
  Loader2,
  Flame,
  RefreshCw,
  Scale,
  ListChecks,
  FileQuestion,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { authHeaders } from '../lib/authHeaders';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';
import ReactMarkdown from 'react-markdown';
import { RemediationService } from '../services/RemediationService';
import { RemediationBoard } from '../components/RemediationBoard';

interface ControlCoverageItem {
  id: string;
  name: string;
  status: 'Met' | 'Partial' | 'Gap';
  evidenceHint: string;
}

interface EvidenceGapItem {
  evidenceName: string;
  reason: string;
  priority: 'High' | 'Medium' | 'Low';
  source?: string;
}

interface AuditAssessment {
  id: string;
  framework: string;
  readinessScore: number;
  status: 'Ready' | 'Near Ready' | 'Not Ready';
  redFlags: string[];
  recommendations: string[];
  auditorOpinion: string;
  createdAt: string;
  controlCoverage?: ControlCoverageItem[];
  coveragePercent?: number;
  evidenceGaps?: EvidenceGapItem[];
}

interface ComplianceFramework {
  id: string;
  name: string;
  progress?: number;
  status?: string;
  gapAnalysis?: {
    evidence_gaps?: string[] | { name?: string; reason?: string; priority?: string }[];
    keyControls?: { id?: string; name?: string }[];
  };
  aiMetadata?: {
    keyControls?: { id?: string; name?: string }[];
  };
}

const FALLBACK_FRAMEWORKS = [
  'NYDFS Part 500',
  'SOC 2 Type II',
  'ISO/IEC 27001:2022',
  'NIST CSF 2.0',
  'GDPR (Article 32)',
];

function normalizeEvidenceGaps(raw: unknown, source: string): EvidenceGapItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (typeof item === 'string') {
        return {
          evidenceName: item,
          reason: 'Identified in compliance gap analysis',
          priority: 'Medium' as const,
          source,
        };
      }
      const obj = item as {
        name?: string;
        evidenceName?: string;
        reason?: string;
        priority?: string;
      };
      const priority =
        obj.priority === 'High' || obj.priority === 'Low' ? obj.priority : 'Medium';
      return {
        evidenceName: obj.evidenceName || obj.name || 'Unnamed evidence',
        reason: obj.reason || 'Missing attestation or artifact',
        priority,
        source,
      };
    });
  }
  return [];
}

export function AuditReadiness() {
  const { profile, loading } = useAuth();
  const [assessments, setAssessments] = useState<AuditAssessment[]>([]);
  const [complianceFrameworks, setComplianceFrameworks] = useState<ComplianceFramework[]>([]);
  const [selectedFramework, setSelectedFramework] = useState('NYDFS Part 500');
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AuditAssessment | null>(null);
  const [scanError, setScanError] = useState('');
  const [ticketState, setTicketState] = useState<Record<string, 'creating' | 'created' | 'error'>>({});
  // Tickets created from this page had nowhere to be viewed (docs/KNOWN_ISSUES.md #15).
  // `remediation` swaps the main panel for the org-wide list; `remediationKey` forces a
  // remount so switching back to it re-fetches rather than showing a stale list after
  // new tickets were created.
  const [mainView, setMainView] = useState<'audits' | 'remediation'>('audits');
  const [remediationKey, setRemediationKey] = useState(0);

  // Closes the loop between a detected gap and an actionable remediation task: generates
  // a real AI plan (server /api/ai/remediation-plan, same service the frozen legacy
  // vendor-risk board already uses) and persists it to the remediations collection.
  // These gaps are org-wide (not tied to one vendor), so tickets are recorded against
  // the organization rather than a specific vendorId.
  const handleCreateTicket = async (key: string, finding: string, recommendation: string) => {
    if (!profile?.organizationId) return;
    setTicketState((prev) => ({ ...prev, [key]: 'creating' }));
    try {
      const plan = await RemediationService.generateAIPlan(finding, recommendation, undefined);
      await RemediationService.createTicket({
        vendorId: 'org-wide',
        vendorName: profile.organizationName || 'Organization',
        ...plan,
        status: 'Backlog',
        createdAt: new Date().toISOString(),
        organizationId: profile.organizationId,
      });
      setTicketState((prev) => ({ ...prev, [key]: 'created' }));
      // Invalidate the remediation list so it reflects this ticket when next opened.
      setRemediationKey((k) => k + 1);
    } catch (e) {
      console.error('Create remediation ticket failed:', e);
      setTicketState((prev) => ({ ...prev, [key]: 'error' }));
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'audit_readiness'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: AuditAssessment[] = [];
        snapshot.forEach((d) => {
          data.push({ id: d.id, ...d.data() } as AuditAssessment);
        });
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAssessments(data);
        setSelectedAudit((prev) => {
          if (prev && data.some((a) => a.id === prev.id)) {
            return data.find((a) => a.id === prev.id) || data[0] || null;
          }
          return data[0] || null;
        });
        setIsLoading(false);
      },
      (error) => {
        console.error('Audit Readiness loading error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.organizationId, loading]);

  useEffect(() => {
    if (!profile?.organizationId) return;
    const q = query(
      collection(db, 'compliance'),
      where('organizationId', '==', profile.organizationId)
    );
    return onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplianceFramework));
      setComplianceFrameworks(rows);
      if (rows.length > 0) {
        setSelectedFramework((prev) => {
          if (rows.some((r) => r.name === prev)) return prev;
          return rows[0].name;
        });
      }
    });
  }, [profile?.organizationId]);

  const frameworkOptions = useMemo(() => {
    const names = complianceFrameworks.map((f) => f.name).filter(Boolean);
    if (names.length === 0) return FALLBACK_FRAMEWORKS;
    const merged = [...names];
    for (const f of FALLBACK_FRAMEWORKS) {
      if (!merged.includes(f)) merged.push(f);
    }
    return merged;
  }, [complianceFrameworks]);

  const runAuditScan = async (frameworkName: string = selectedFramework) => {
    if (!profile?.organizationId) return;
    setIsScanning(true);
    setScanError('');

    try {
      const [
        risksSnap,
        policiesSnap,
        incidentsSnap,
        connectorsSnap,
        vendorsSnap,
        complianceSnap,
        evidenceSnap,
      ] = await Promise.all([
        getDocs(query(collection(db, 'risks'), where('organizationId', '==', profile.organizationId))),
        getDocs(
          query(
            collection(db, 'policies'),
            where('organizationId', '==', profile.organizationId),
            where('status', '==', 'Active')
          )
        ),
        getDocs(
          query(
            collection(db, 'incidents'),
            where('organizationId', '==', profile.organizationId),
            where('status', '!=', 'Resolved')
          )
        ),
        getDocs(
          query(collection(db, 'connectors'), where('organizationId', '==', profile.organizationId))
        ),
        getDocs(query(collection(db, 'vendors'), where('organizationId', '==', profile.organizationId))),
        getDocs(
          query(collection(db, 'compliance'), where('organizationId', '==', profile.organizationId))
        ),
        getDocs(
          query(
            collection(db, 'evidence_reviews'),
            where('organizationId', '==', profile.organizationId)
          )
        ),
      ]);

      const matchingCompliance = complianceSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ComplianceFramework))
        .find((f) => f.name === frameworkName);

      const complianceGaps = normalizeEvidenceGaps(
        matchingCompliance?.gapAnalysis?.evidence_gaps,
        'compliance'
      );

      const evidenceReviewGaps: EvidenceGapItem[] = [];
      evidenceSnap.docs.forEach((d) => {
        const data = d.data() as {
          missingEvidence?: EvidenceGapItem[];
          vendorName?: string;
        };
        (data.missingEvidence || []).forEach((g) => {
          evidenceReviewGaps.push({
            evidenceName: g.evidenceName,
            reason: g.reason || `Vendor evidence gap (${data.vendorName || 'vendor'})`,
            priority: g.priority || 'Medium',
            source: 'evidence_reviews',
          });
        });
      });

      const knownGaps = [...complianceGaps, ...evidenceReviewGaps].slice(0, 40);
      const knownControls =
        matchingCompliance?.aiMetadata?.keyControls ||
        matchingCompliance?.gapAnalysis?.keyControls ||
        [];

      const context = {
        risks: risksSnap.docs.map((d) => d.data()),
        activePolicies: policiesSnap.docs.map((d) => d.data().title),
        openIncidents: incidentsSnap.size,
        connectors: connectorsSnap.docs.map((d) => ({
          type: d.data().type,
          health: d.data().health,
        })),
        vendors: vendorsSnap.docs.map((d) => ({
          name: d.data().name,
          criticality: d.data().criticality,
          impactLevel: d.data().impactLevel,
          riskScore: d.data().riskScore,
        })),
        knownEvidenceGaps: knownGaps,
        knownControls,
        complianceProgress: matchingCompliance?.progress ?? null,
      };

      const prompt = `Act as a strict regulatory auditor.
Analyze organizational data for audit readiness against the ${frameworkName} framework.

Context:
- Risks: ${JSON.stringify(context.risks).slice(0, 6000)}
- Active Policies: ${JSON.stringify(context.activePolicies)}
- Open Incidents: ${context.openIncidents}
- Infrastructure Health: ${JSON.stringify(context.connectors)}
- Third-Party Landscape: ${JSON.stringify(context.vendors)}
- Known evidence gaps (from Compliance + Evidence Reviews): ${JSON.stringify(context.knownEvidenceGaps)}
- Known controls: ${JSON.stringify(context.knownControls)}
- Existing compliance progress: ${context.complianceProgress}

Return JSON with:
- readinessScore (0-100) grounded in the evidence (not optimistic)
- status ("Ready", "Near Ready", "Not Ready")
- redFlags (string[])
- recommendations (string[])
- auditorOpinion (blunt professional summary)
- coveragePercent (0-100) estimated control coverage for ${frameworkName}
- controlCoverage: array of { id, name, status: Met|Partial|Gap, evidenceHint } — include 6-12 representative controls
- evidenceGaps: array of { evidenceName, reason, priority: High|Medium|Low } merging known gaps and newly inferred ones

Call out TPRM and incident-response gaps when relevant.`;

      const responseSchema = {
        type: 'OBJECT',
        properties: {
          readinessScore: { type: 'NUMBER' },
          status: { type: 'STRING' },
          redFlags: { type: 'ARRAY', items: { type: 'STRING' } },
          recommendations: { type: 'ARRAY', items: { type: 'STRING' } },
          auditorOpinion: { type: 'STRING' },
          coveragePercent: { type: 'NUMBER' },
          controlCoverage: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                name: { type: 'STRING' },
                status: { type: 'STRING' },
                evidenceHint: { type: 'STRING' },
              },
              required: ['id', 'name', 'status', 'evidenceHint'],
            },
          },
          evidenceGaps: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                evidenceName: { type: 'STRING' },
                reason: { type: 'STRING' },
                priority: { type: 'STRING' },
              },
              required: ['evidenceName', 'reason', 'priority'],
            },
          },
        },
        required: [
          'readinessScore',
          'status',
          'redFlags',
          'recommendations',
          'auditorOpinion',
          'controlCoverage',
          'evidenceGaps',
        ],
      };

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        // No model override — the server picks the supported default. This used to pin
        // 'gemini-3.1-pro-preview', which the server forwarded verbatim; when that name
        // didn't resolve the scan failed with a generic "AI generation failed".
        body: JSON.stringify({
          prompt,
          responseMimeType: 'application/json',
          responseSchema,
        }),
      });
      if (!response.ok) throw new Error('AI generation failed');
      const { text } = await response.json();

      const result = JSON.parse(text || '{}');
      const readinessScore = Number(result.readinessScore) || 0;

      await addDoc(collection(db, 'audit_readiness'), {
        ...result,
        readinessScore,
        framework: frameworkName,
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString(),
      });

      if (matchingCompliance?.id) {
        const status =
          readinessScore >= 85
            ? 'Compliant'
            : readinessScore >= 50
              ? 'In Progress'
              : 'Needs Attention';
        await updateDoc(doc(db, 'compliance', matchingCompliance.id), {
          progress: readinessScore,
          status,
          lastAuditReadinessAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Audit scan failed:', error);
      setScanError(error instanceof Error ? error.message : 'Audit scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const coverageStatusClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'met') return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300';
    if (s === 'partial') return 'border-amber-500/30 bg-amber-500/5 text-amber-300';
    return 'border-rose-500/30 bg-rose-500/5 text-rose-300';
  };

  const priorityClass = (priority: string) => {
    if (priority === 'High') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (priority === 'Low') return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 animate-in fade-in duration-700">
      <div className="flex w-80 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Audit Lab</h1>
          <Button
            size="sm"
            onClick={() => runAuditScan(selectedFramework)}
            disabled={isScanning}
            className="rounded-full border border-primary/30 bg-primary/20 text-primary hover:bg-primary/30"
          >
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Framework
          </label>
          <select
            value={selectedFramework}
            onChange={(e) => setSelectedFramework(e.target.value)}
            className="h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white [&>option]:bg-slate-950 [&>option]:text-white"
          >
            {frameworkOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            {complianceFrameworks.length > 0
              ? 'Pulled from Compliance; scan syncs progress back.'
              : 'No Compliance frameworks yet — using common defaults.'}
          </p>
        </div>

        {scanError && <p className="text-xs text-rose-400">{scanError}</p>}

        {/* Assessments vs the org-wide remediation list. Tickets created from a readiness
            report used to have no view anywhere in the active app (KNOWN_ISSUES #15). */}
        <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
          {([
            { id: 'audits' as const, label: 'Assessments' },
            { id: 'remediation' as const, label: 'Remediation' },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainView(tab.id)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors',
                mainView === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
            </div>
          ) : assessments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/5 bg-white/5 py-12 text-center">
              <Scale className="mx-auto mb-2 h-8 w-8 text-slate-700" />
              <p className="mx-auto max-w-[180px] text-xs text-slate-500">
                No assessments yet. Pick a framework and run a readiness scan.
              </p>
            </div>
          ) : (
            assessments.map((audit) => (
              <button
                key={audit.id}
                type="button"
                onClick={() => {
                  setSelectedAudit(audit);
                  // Picking a report while the remediation list is showing should bring
                  // the report forward, otherwise the click appears to do nothing.
                  setMainView('audits');
                }}
                className={cn(
                  'group relative w-full overflow-hidden rounded-xl border p-4 text-left transition-all',
                  selectedAudit?.id === audit.id
                    ? 'border-white/10 bg-white/10 shadow-xl'
                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {audit.framework}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-[10px]',
                      audit.readinessScore > 80
                        ? 'text-emerald-400'
                        : audit.readinessScore > 50
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    )}
                  >
                    {audit.readinessScore}%
                  </span>
                </div>
                <h3 className="mb-1 text-sm font-bold text-white">
                  {new Date(audit.createdAt).toLocaleDateString()} Assessment
                </h3>
                <p className="font-mono text-[10px] text-slate-500">
                  Status:{' '}
                  <span className={audit.status === 'Ready' ? 'text-emerald-400' : 'text-amber-400'}>
                    {audit.status}
                  </span>
                </p>
                {selectedAudit?.id === audit.id && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute bottom-0 left-0 top-0 w-1 bg-primary"
                  />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="glass-panel flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/5">
        <AnimatePresence mode="wait">
          {mainView === 'remediation' ? (
            <motion.div
              key={`remediation-${remediationKey}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <RemediationBoard
                organizationId={profile?.organizationId || ''}
                canDelete={profile?.role === 'admin'}
              />
            </motion.div>
          ) : selectedAudit ? (
            <motion.div
              key={selectedAudit.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 bg-white/5 p-8">
                <div>
                  <div className="mb-1 flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white">
                      {selectedAudit.framework} Readiness Report
                    </h2>
                    <div
                      className={cn(
                        'rounded-full border bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest',
                        selectedAudit.status === 'Ready'
                          ? 'border-emerald-500/30 text-emerald-400'
                          : 'border-amber-500/30 text-amber-400'
                      )}
                    >
                      {selectedAudit.status}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    Generated on {new Date(selectedAudit.createdAt).toLocaleString()} by Guardentra AI
                    Auditor
                  </p>
                </div>
                <div className="flex items-center gap-8">
                  {typeof selectedAudit.coveragePercent === 'number' && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Control Coverage
                      </p>
                      <p className="font-mono text-2xl font-bold text-sky-300">
                        {selectedAudit.coveragePercent}%
                      </p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Readiness Score
                    </p>
                    <p
                      className={cn(
                        'font-mono text-4xl font-bold',
                        selectedAudit.readinessScore > 80 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {selectedAudit.readinessScore}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto p-8">
                <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-6 lg:col-span-2">
                    <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                      <Scale className="h-4 w-4 text-primary" />
                      Official Auditor Opinion
                    </h3>
                    <div className="prose prose-invert prose-sm max-w-none italic leading-relaxed text-slate-300">
                      <ReactMarkdown>{selectedAudit.auditorOpinion}</ReactMarkdown>
                    </div>
                  </div>

                  {(selectedAudit.controlCoverage?.length || 0) > 0 && (
                    <div className="space-y-4 lg:col-span-2">
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
                        <ListChecks className="h-4 w-4" />
                        Control Coverage
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedAudit.controlCoverage!.map((c) => (
                          <div
                            key={c.id}
                            className={cn('rounded-xl border p-4', coverageStatusClass(c.status))}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-white">{c.name}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wide">
                                {c.status}
                              </span>
                            </div>
                            <p className="font-mono text-[10px] text-slate-500">{c.id}</p>
                            <p className="mt-2 text-xs text-slate-400">{c.evidenceHint}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selectedAudit.evidenceGaps?.length || 0) > 0 && (
                    <div className="space-y-4 lg:col-span-2">
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
                        <FileQuestion className="h-4 w-4" />
                        Evidence Gaps
                      </h3>
                      <div className="space-y-3">
                        {selectedAudit.evidenceGaps!.map((gap, i) => {
                          const key = `gap-${i}-${gap.evidenceName}`;
                          const state = ticketState[key];
                          return (
                            <div
                              key={key}
                              className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-slate-950/40 p-4"
                            >
                              <div>
                                <p className="text-sm font-medium text-white">{gap.evidenceName}</p>
                                <p className="mt-1 text-xs text-slate-400">{gap.reason}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span
                                  className={cn(
                                    'rounded-full border px-2 py-0.5 text-[10px] font-mono',
                                    priorityClass(gap.priority)
                                  )}
                                >
                                  {gap.priority}
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 border-white/10 px-2 text-[10px]"
                                  disabled={state === 'creating' || state === 'created'}
                                  onClick={() =>
                                    void handleCreateTicket(key, `Evidence gap: ${gap.evidenceName}`, gap.reason)
                                  }
                                >
                                  {state === 'creating' ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : state === 'created' ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-500">
                      <Flame className="h-4 w-4" />
                      Audit Red Flags
                    </h3>
                    <div className="space-y-4">
                      {(selectedAudit.redFlags || []).map((flag, i) => (
                        <div
                          key={i}
                          className="flex gap-4 rounded-xl border border-rose-500/10 bg-rose-500/5 p-4"
                        >
                          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
                          <p className="text-sm text-slate-300">{flag}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-500">
                      <ClipboardCheck className="h-4 w-4" />
                      Remediation Checklist
                    </h3>
                    <div className="space-y-4">
                      {(selectedAudit.recommendations || []).map((rec, i) => {
                        const key = `rec-${i}`;
                        const state = ticketState[key];
                        return (
                          <div
                            key={key}
                            className="flex items-start justify-between gap-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4"
                          >
                            <div className="flex gap-4">
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                              <p className="text-sm text-slate-300">{rec}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 shrink-0 border-white/10 px-2 text-[10px]"
                              disabled={state === 'creating' || state === 'created'}
                              onClick={() => void handleCreateTicket(key, rec, rec)}
                              title={state === 'created' ? 'Remediation ticket created' : 'Create remediation ticket'}
                            >
                              {state === 'creating' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : state === 'created' ? (
                                <>
                                  <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-400" /> Ticket created
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-1 h-3 w-3" /> Create Ticket
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-slate-500">
              <ShieldCheck className="mb-6 h-16 w-16 text-slate-700 opacity-20" />
              <h2 className="mb-2 text-xl font-bold text-white">Audit Readiness Lab</h2>
              <p className="mx-auto mb-8 max-w-xs text-sm">
                Pick a compliance framework, then run a scan that pulls risks, policies, vendors, and
                known evidence gaps.
              </p>
              <Button
                onClick={() => runAuditScan(selectedFramework)}
                disabled={isScanning}
                className="min-w-[200px] bg-primary text-white hover:bg-primary/90"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Start Readiness Scan
                  </>
                )}
              </Button>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
