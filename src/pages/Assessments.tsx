import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import {
  Plus,
  Search,
  ExternalLink,
  CheckCircle2,
  Loader2,
  FileText,
  Sparkles,
  X,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { motion } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';
import { useOrgAssessments } from '../lib/vendor/useOrgAssessments';
import { useOrgVendors } from '../lib/vendor/useOrgVendors';
import {
  deriveStatusFromAssessments,
  upsertLocalAssessment,
  type StoredAssessment,
} from '../lib/vendor/localAssessmentStore';
import { FRAMEWORK_CATALOG } from '../lib/vendor/constants';

const SELECT_CLASS =
  'h-9 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white [&>option]:bg-slate-950 [&>option]:text-white';

function frameworkLabel(a: StoredAssessment): string {
  if (a.frameworkName) return a.frameworkName;
  if (a.frameworks?.length) {
    return a.frameworks
      .map((id) => FRAMEWORK_CATALOG.find((f) => f.id === id)?.name || id)
      .join(', ');
  }
  return 'Assessment';
}

function progressOf(a: StoredAssessment): number {
  return a.progressPct ?? a.progress ?? 0;
}

function dueLabel(a: StoredAssessment): string {
  return a.dueDate || (a.dueAt ? a.dueAt.slice(0, 10) : '—');
}

export function Assessments() {
  const { profile, loading: authLoading } = useAuth();
  const orgId = profile?.organizationId;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const presetVendorId = params.get('vendorId') || '';

  const { assessments, mode, loading, refreshLocal } = useOrgAssessments(orgId);
  const { vendors } = useOrgVendors(orgId);

  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState(presetVendorId || 'all');
  const [reviewAssessment, setReviewAssessment] = useState<StoredAssessment | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewAnalysis, setReviewAnalysis] = useState<{
    summary: string;
    rating: string;
    recommendation: string;
  } | null>(null);

  useEffect(() => {
    if (presetVendorId) setVendorFilter(presetVendorId);
  }, [presetVendorId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assessments.filter((a) => {
      if (vendorFilter !== 'all' && a.vendorId !== vendorFilter) return false;
      if (!q) return true;
      const hay = `${a.vendorName || ''} ${frameworkLabel(a)} ${a.status || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [assessments, search, vendorFilter]);

  const vendorOptions = useMemo(() => {
    const fromAsm = assessments.map((a) => ({ id: a.vendorId, name: a.vendorName || a.vendorId }));
    const map = new Map<string, string>();
    vendors.forEach((v) => map.set(v.id, v.name));
    fromAsm.forEach((v) => {
      if (v.id && !map.has(v.id)) map.set(v.id, v.name);
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assessments, vendors]);

  const clearVendorFilter = () => {
    setVendorFilter('all');
    if (params.has('vendorId')) {
      params.delete('vendorId');
      setParams(params, { replace: true });
    }
  };

  const handleReviewAssessment = async (assessment: StoredAssessment) => {
    setReviewAssessment(assessment);
    setReviewAnalysis(null);
    setIsReviewing(true);

    if (assessment.status === 'Under Review' || assessment.status === 'Completed') {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const questions = (assessment.questions || []) as { question?: string; answer?: string }[];
        const answers = questions.map((q) => `${q.question}: ${q.answer || 'No Answer'}`).join('\n');
        const prompt = `Analyze vendor assessment for "${assessment.vendorName}" against "${frameworkLabel(assessment)}".
        Answers:
        ${answers}
        
        Provide a risk summary, an overall security rating (A-F), and one primary recommendation.
        Return JSON: { "summary": "...", "rating": "...", "recommendation": "..." }`;

        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        setReviewAnalysis(JSON.parse(result.text || '{}'));
      } catch (e) {
        console.error('AI Review failed:', e);
      }
    }
  };

  const handleApproveAssessment = async () => {
    if (!reviewAssessment || !orgId) return;
    try {
      if (mode === 'local' || reviewAssessment.id.startsWith('local_')) {
        upsertLocalAssessment(orgId, {
          ...reviewAssessment,
          status: 'Completed',
          progressPct: 100,
          progress: 100,
          completedAt: new Date().toISOString(),
        });
        refreshLocal();
      } else {
        await updateDoc(doc(db, 'assessments', reviewAssessment.id), {
          status: 'Completed',
          progress: 100,
          progressPct: 100,
        });
      }
      setIsReviewing(false);
    } catch (e) {
      console.error('Approval failed:', e);
    }
  };

  const activeCount = assessments.filter((a) => a.status !== 'Completed').length;
  const avgCompletion =
    assessments.length > 0
      ? Math.round(assessments.reduce((acc, curr) => acc + progressOf(curr), 0) / assessments.length)
      : 0;
  const overdueCount = assessments.filter((a) => {
    const status = deriveStatusFromAssessments([a]);
    return status === 'Overdue';
  }).length;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white text-glow">
            Structured Assessments
          </h1>
          <p className="mt-1 text-slate-400">
            Vendor security questionnaires linked to your vendor register.
            {mode === 'local' && (
              <span className="ml-2 rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                Local store
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() =>
            navigate(
              vendorFilter !== 'all'
                ? `/assessments/new?vendorId=${encodeURIComponent(vendorFilter)}`
                : '/assessments/new'
            )
          }
          className="bg-primary text-white hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card className="flex flex-col items-center justify-center border-white/5 bg-slate-900/50 p-4 text-center">
          <Badge variant="outline" className="mb-2 border-blue-500/20 bg-blue-500/10 text-blue-400">
            Active Assessments
          </Badge>
          <div className="text-3xl font-bold text-white">{activeCount}</div>
        </Card>
        <Card className="flex flex-col items-center justify-center border-white/5 bg-slate-900/50 p-4 text-center">
          <Badge
            variant="outline"
            className="mb-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          >
            Avg Completion
          </Badge>
          <div className="text-3xl font-bold text-white">{avgCompletion}%</div>
        </Card>
        <Card className="flex flex-col items-center justify-center border-white/5 bg-slate-900/50 p-4 text-center">
          <Badge variant="outline" className="mb-2 border-amber-500/20 bg-amber-500/10 text-amber-400">
            Overdue
          </Badge>
          <div className="text-3xl font-bold text-white">{overdueCount}</div>
        </Card>
        <Card className="flex flex-col items-center justify-center border-white/5 bg-slate-900/50 p-4 text-center">
          <Badge
            variant="outline"
            className="mb-2 border-purple-500/20 bg-purple-500/10 text-purple-400"
          >
            Linked Vendors
          </Badge>
          <div className="text-3xl font-bold text-white">{vendorOptions.length}</div>
        </Card>
      </div>

      <Card className="border-white/5 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">Assessment Tracker</CardTitle>
          <CardDescription className="text-slate-500">
            Monitor vendor response status — filter by vendor to see the correlation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assessments..."
                className="border-white/10 bg-black/20 pl-10 text-white"
              />
            </div>
            <select
              className={SELECT_CLASS}
              value={vendorFilter}
              onChange={(e) => {
                const v = e.target.value;
                setVendorFilter(v);
                if (v === 'all') {
                  clearVendorFilter();
                } else {
                  setParams({ vendorId: v }, { replace: true });
                }
              }}
              aria-label="Filter by vendor"
            >
              <option value="all">All vendors</option>
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {vendorFilter !== 'all' && (
              <Button type="button" variant="outline" className="border-white/10" onClick={clearVendorFilter}>
                Clear vendor filter
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Vendor
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Framework
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Progress
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Due Date
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Loading assessments…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <p className="mb-3">
                        {assessments.length === 0
                          ? 'No assessments yet — pick a vendor in New Assessment.'
                          : 'No assessments match this filter.'}
                      </p>
                      <Button
                        className="bg-primary text-white hover:bg-primary/90"
                        onClick={() => navigate('/assessments/new')}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New Assessment
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr key={a.id} className="group transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                          </div>
                          <div>
                            <Link
                              to={`/vendors/${a.vendorId}/impact`}
                              className="text-sm font-bold text-white hover:text-primary hover:underline"
                            >
                              {a.vendorName || 'Vendor'}
                            </Link>
                            <p className="text-[10px] text-slate-500">Linked vendor</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant="outline"
                          className="border-indigo-500/20 font-mono text-[10px] uppercase tracking-tighter text-indigo-400"
                        >
                          {frameworkLabel(a)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                            a.status === 'Sent'
                              ? 'bg-amber-500/10 text-amber-400'
                              : a.status === 'In Progress'
                                ? 'bg-blue-500/10 text-blue-400'
                                : a.status === 'Completed'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-slate-500/10 text-slate-400'
                          )}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 max-w-[60px] flex-1 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full bg-primary" style={{ width: `${progressOf(a)}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">{progressOf(a)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs italic text-slate-500">{dueLabel(a)}</td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mr-2 h-8 w-8 p-0 text-slate-400 transition-colors hover:text-primary"
                          onClick={() => {
                            const url = `${window.location.origin}/portal/${a.id}`;
                            void navigator.clipboard.writeText(url);
                          }}
                          title="Copy Vendor Portal Link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 transition-colors hover:text-white"
                          onClick={() => void handleReviewAssessment(a)}
                          title="Review Assessment"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isReviewing && reviewAssessment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10"
          >
            <div className="flex items-center justify-between border-b border-white/5 p-6">
              <div>
                <h2 className="mb-1 text-xl font-bold leading-none text-white">
                  {reviewAssessment.vendorName}
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  {frameworkLabel(reviewAssessment)} Review
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsReviewing(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="space-y-8 lg:col-span-2">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Response Intelligence
                  </h3>
                  {((reviewAssessment.questions || []) as { id?: string; question?: string; answer?: string; category?: string }[]).map(
                    (q, idx) => (
                      <div key={q.id || idx} className="space-y-3">
                        <div className="flex gap-4">
                          <span className="mt-1 font-mono text-xs text-slate-700">0{idx + 1}</span>
                          <div className="flex-1">
                            <p className="mb-2 text-sm font-medium text-slate-200">{q.question}</p>
                            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                              <p className="text-sm font-medium text-primary">
                                {q.answer || 'No response provided.'}
                              </p>
                            </div>
                            {q.category && (
                              <div className="mt-2 flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="border-white/5 px-1 py-0 text-[9px] text-slate-500"
                                >
                                  {q.category}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                  {!(reviewAssessment.questions || []).length && (
                    <p className="text-sm text-slate-500">No question responses yet.</p>
                  )}
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">AI Risk Audit</h3>
                  <Card className="overflow-hidden border-indigo-500/20 bg-indigo-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-bold text-indigo-400">
                        <Sparkles className="h-4 w-4" />
                        Automated Scoring
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!reviewAnalysis ? (
                        <div className="flex items-center gap-3 py-4 text-xs italic text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analysis available after vendor responds.
                        </div>
                      ) : (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-slate-400">Risk Rating</span>
                            <span
                              className={cn(
                                'font-mono text-3xl font-black',
                                ['A', 'B'].includes(reviewAnalysis.rating)
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              )}
                            >
                              {reviewAnalysis.rating}
                            </span>
                          </div>
                          <p className="border-l-2 border-primary py-1 pl-3 text-[11px] italic leading-relaxed text-slate-300">
                            &quot;{reviewAnalysis.summary}&quot;
                          </p>
                          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
                            <p className="mb-1 text-[9px] font-bold uppercase text-indigo-300">
                              CISO Recommendation
                            </p>
                            <p className="text-[10px] text-slate-300">{reviewAnalysis.recommendation}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                    <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">
                      Decision Terminal
                    </h4>
                    <div className="space-y-3">
                      <Button
                        className="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-500"
                        onClick={() => void handleApproveAssessment()}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Sign Off & Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
