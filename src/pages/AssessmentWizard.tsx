import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection } from 'firebase/firestore';
import { ArrowRight, Check, ChevronDown, ChevronRight, Eye, Search } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { FRAMEWORK_CATALOG } from '../lib/vendor/constants';
import type { FrameworkId } from '../lib/vendor/types';
import { effectiveRiskLevel, riskBandClasses } from '../lib/vendor/risk';
import { validateAssessmentWizard } from '../lib/vendor/validators';
import {
  buildQuestionsForFrameworks,
  QUESTION_CATEGORIES,
  type PortalQuestion,
} from '../lib/vendor/questionBank';
import { useOrgVendors } from '../lib/vendor/useOrgVendors';
import { createLocalAssessment } from '../lib/vendor/localAssessmentStore';
import { isFirestoreUnavailableError } from '../lib/vendor/localVendorStore';
import { syncVendorAfterAssessmentCreate } from '../lib/vendor/syncVendorAssessment';

export function AssessmentWizard() {
  const { profile } = useAuth();
  const orgId = profile?.organizationId;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetVendorId = params.get('vendorId') || '';

  const { vendors, mode: vendorMode, loading: vendorsLoading } = useOrgVendors(orgId);

  const [step, setStep] = useState<1 | 2 | 3>(presetVendorId ? 2 : 1);
  const [search, setSearch] = useState('');
  const [vendorId, setVendorId] = useState(presetVendorId);
  const [frameworks, setFrameworks] = useState<FrameworkId[]>(['nist_csf_2', 'soc2']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const selected = vendors.find((v) => v.id === vendorId);
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return vendors.filter((v) => !s || v.name.toLowerCase().includes(s));
  }, [vendors, search]);

  const previewQuestions = useMemo(
    () => buildQuestionsForFrameworks(frameworks),
    [frameworks]
  );

  const questionsByCategory = useMemo(() => {
    const map = Object.fromEntries(QUESTION_CATEGORIES.map((c) => [c, [] as PortalQuestion[]])) as Record<
      string,
      PortalQuestion[]
    >;
    for (const q of previewQuestions) {
      map[q.category] = map[q.category] || [];
      map[q.category].push(q);
    }
    return map;
  }, [previewQuestions]);

  const sourceQuestions = frameworks.reduce((sum, id) => {
    const f = FRAMEWORK_CATALOG.find((x) => x.id === id);
    return sum + (f?.questionCount || 0);
  }, 0);
  const uniqueQuestions = previewQuestions.length;

  const toggleFramework = (id: FrameworkId) => {
    setFrameworks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const continueToFrameworks = () => {
    if (!vendorId) {
      setError('Select a vendor to continue.');
      return;
    }
    setError('');
    setStep(2);
  };

  const continueToPreview = () => {
    const err = validateAssessmentWizard({ vendorId, frameworks });
    if (err) {
      setError(err);
      return;
    }
    setError('');
    const open: Record<string, boolean> = {};
    QUESTION_CATEGORIES.forEach((c) => {
      open[c] = true;
    });
    setExpanded(open);
    setStep(3);
  };

  const createLocalAndOpen = async () => {
    if (!orgId || !selected) return;
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const questions = buildQuestionsForFrameworks(frameworks);
    const frameworkName = frameworks
      .map((id) => FRAMEWORK_CATALOG.find((f) => f.id === id)?.name || id)
      .join(', ');
    const local = createLocalAssessment(orgId, {
      vendorId,
      vendorName: selected.name,
      frameworks,
      frameworkName,
      status: 'Sent',
      dueAt: due.toISOString(),
      questionCount: questions.length,
      sourceQuestionCount: sourceQuestions,
      questions,
    });
    await syncVendorAfterAssessmentCreate(orgId, vendorId, true);
    navigate(`/assessments?vendorId=${encodeURIComponent(vendorId)}`);
    return local.id;
  };

  const createAssessment = async () => {
    const err = validateAssessmentWizard({ vendorId, frameworks });
    if (err) {
      setError(err);
      return;
    }
    if (!orgId || !selected) return;
    setSaving(true);
    setError('');
    try {
      const due = new Date();
      due.setDate(due.getDate() + 14);
      const questions = buildQuestionsForFrameworks(frameworks);
      const frameworkName = frameworks
        .map((id) => FRAMEWORK_CATALOG.find((f) => f.id === id)?.name || id)
        .join(', ');

      if (vendorMode === 'local' || vendorId.startsWith('local_')) {
        await createLocalAndOpen();
        return;
      }

      const writeTimeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          const e = new Error('Cloud assessment create timed out');
          (e as { code?: string }).code = 'unavailable';
          reject(e);
        }, 4000);
      });

      const ref = await Promise.race([
        addDoc(collection(db, 'assessments'), {
          vendorId,
          vendorName: selected.name,
          organizationId: orgId,
          frameworks,
          frameworkName,
          status: 'Sent',
          dueAt: due.toISOString(),
          dueDate: due.toISOString().slice(0, 10),
          progressPct: 0,
          progress: 0,
          questionCount: questions.length,
          sourceQuestionCount: sourceQuestions,
          questions,
          portalOpen: true,
          createdAt: new Date().toISOString(),
        }),
        writeTimeout,
      ]);

      try {
        await addDoc(collection(db, 'vendor_assessments'), {
          vendorId,
          type: 'Questionnaire',
          summary: `Framework assessment: ${frameworks.join(', ')}`,
          findings: [],
          score: 0,
          organizationId: orgId,
          createdAt: new Date().toISOString(),
          assessmentId: ref.id,
        });
      } catch {
        /* legacy stub is best-effort */
      }

      await syncVendorAfterAssessmentCreate(orgId, vendorId, false);
      navigate(`/portal/${ref.id}`);
    } catch (ex: unknown) {
      if (isFirestoreUnavailableError(ex)) {
        try {
          await createLocalAndOpen();
          return;
        } catch (localEx: unknown) {
          setError(localEx instanceof Error ? localEx.message : 'Failed to create local assessment.');
        }
      } else {
        setError(ex instanceof Error ? ex.message : 'Failed to create assessment.');
      }
    } finally {
      setSaving(false);
    }
  };

  const setAllExpanded = (value: boolean) => {
    const next: Record<string, boolean> = {};
    QUESTION_CATEGORIES.forEach((c) => {
      next[c] = value;
    });
    setExpanded(next);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link to="/vendors" className="text-sm text-primary hover:underline">
            ← Back to Vendors
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-white text-glow">New assessment</h1>
          <p className="text-sm text-slate-400">
            Select a vendor, choose frameworks, then preview questions before sending.
            {vendorMode === 'local' && (
              <span className="ml-2 rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                Local vendors
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest',
              step === 1 ? 'bg-primary text-white' : 'bg-white/10 text-slate-300'
            )}
          >
            1. Vendor
          </span>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest',
              step === 2 ? 'bg-primary text-white' : 'bg-white/10 text-slate-300'
            )}
          >
            2. Frameworks
          </span>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest',
              step === 3 ? 'bg-primary text-white' : 'bg-white/10 text-slate-300'
            )}
          >
            3. Preview
          </span>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {step === 1 && (
        <div className="max-w-xl space-y-4 rounded-xl border border-white/5 bg-slate-900/50 p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendors..."
              className="border-white/10 bg-black/20 pl-9 text-white"
            />
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {vendorsLoading && <p className="text-sm text-slate-400">Loading vendors…</p>}
            {!vendorsLoading &&
              filtered.map((v) => {
                const level = effectiveRiskLevel(v);
                const active = v.id === vendorId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVendorId(v.id)}
                    className={cn(
                      'flex w-full items-start justify-between rounded-xl border p-4 text-left',
                      active ? 'border-primary bg-primary/15' : 'border-white/10 hover:bg-white/5'
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{v.name}</p>
                        {active && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-sm text-slate-400">{v.category}</p>
                      <p className="mt-1 text-xs text-slate-500">{v.primaryContactName || 'No contact'}</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium',
                        riskBandClasses(level)
                      )}
                    >
                      {level}
                      {v.riskScore > 0 ? ` ${v.riskScore}` : ''}
                    </span>
                  </button>
                );
              })}
            {!vendorsLoading && filtered.length === 0 && (
              <div className="space-y-2 text-sm text-slate-400">
                <p>No vendors found.</p>
                <Link to="/vendors" className="text-primary hover:underline">
                  Add a vendor first →
                </Link>
              </div>
            )}
          </div>
          <Button className="w-full bg-primary text-white hover:bg-primary/90" onClick={continueToFrameworks}>
            Continue to Frameworks <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {selected && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-slate-200">
              <span className="font-medium">{selected.name}</span>
              <span className="text-slate-400"> · {selected.category}</span>
              <button type="button" className="ml-3 text-primary hover:underline" onClick={() => setStep(1)}>
                Change
              </button>
            </div>
          )}
          {!selected && presetVendorId && (
            <p className="text-sm text-amber-300">
              Preset vendor not in this org list — go back and pick a vendor.
            </p>
          )}
          <div>
            <h2 className="text-lg font-semibold text-white">Build the right assessment</h2>
            <p className="text-sm text-slate-400">
              Select one or more frameworks. GuardEntra removes duplicate questions automatically.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FRAMEWORK_CATALOG.map((f) => {
              const on = frameworks.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleFramework(f.id)}
                  className={cn(
                    'rounded-xl border p-4 text-left',
                    on ? 'border-primary bg-primary/15' : 'border-white/10 bg-slate-900/50 hover:bg-white/5'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white">{f.name}</p>
                    <span
                      className={cn(
                        'mt-0.5 h-4 w-4 rounded border',
                        on ? 'border-primary bg-primary' : 'border-white/20'
                      )}
                    />
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{f.description}</p>
                  <p className="mt-2 text-xs text-primary">
                    {f.questionCount ? `${f.questionCount} questions` : 'Custom'}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4 text-sm text-slate-400">
            AI removes duplicate questions. Estimated unique set: <strong>{uniqueQuestions}</strong> (from{' '}
            {sourceQuestions} source questions).
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/10" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="bg-primary text-white hover:bg-primary/90" onClick={continueToPreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview questionnaire
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          {selected && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-slate-200">
              <span className="font-medium">{selected.name}</span>
              <span className="text-slate-400">
                {' '}
                · {frameworks.map((id) => FRAMEWORK_CATALOG.find((f) => f.id === id)?.name || id).join(', ')}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Security assessment preview</h2>
              <p className="text-sm text-slate-400">
                {uniqueQuestions} questions across {QUESTION_CATEGORIES.length} categories — review before send.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="border-white/10" onClick={() => setAllExpanded(true)}>
                Expand all
              </Button>
              <Button type="button" variant="outline" className="border-white/10" onClick={() => setAllExpanded(false)}>
                Collapse all
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {QUESTION_CATEGORIES.map((category) => {
              const questions = questionsByCategory[category] || [];
              if (!questions.length) return null;
              const open = expanded[category] !== false;
              return (
                <div key={category} className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
                    onClick={() => setExpanded((prev) => ({ ...prev, [category]: !open }))}
                  >
                    <div className="flex items-center gap-2">
                      {open ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="font-medium text-white">{category}</span>
                    </div>
                    <span className="text-xs text-slate-500">{questions.length} questions</span>
                  </button>
                  {open && (
                    <ol className="space-y-3 border-t border-white/5 px-4 py-3">
                      {questions.map((q, idx) => (
                        <li key={q.id} className="text-sm">
                          <p className="text-slate-200">
                            <span className="mr-2 font-mono text-xs text-slate-500">{idx + 1}.</span>
                            {q.question}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Single choice · {q.options.join(' / ')}
                            {q.required ? ' · Required' : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="border-white/10" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              disabled={saving}
              onClick={() => void createAssessment()}
            >
              {saving ? 'Creating…' : 'Create assessment'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
