import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection } from 'firebase/firestore';
import { Check, ChevronDown, ChevronRight, Eye, Search, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { FRAMEWORK_CATALOG } from '../lib/vendor/constants';
import type { FrameworkId } from '../lib/vendor/types';
import { displayRiskScore, effectiveRiskLevel, hasRealRiskScore, riskBandClasses } from '../lib/vendor/risk';
import { validateAssessmentWizard } from '../lib/vendor/validators';
import {
  QUESTION_CATEGORIES,
  type PortalQuestion,
} from '../lib/vendor/questionBank';
import {
  buildQuestionsForPackIds,
  resolvePackIdsForFrameworks,
  QUESTION_BANK_VERSION,
} from '../lib/vendor/frameworkPacks';
import { loadOrgFrameworkPackDefaults } from '../lib/vendor/orgFrameworkPacks';
import { useOrgVendors } from '../lib/vendor/useOrgVendors';
import { createLocalAssessment } from '../lib/vendor/localAssessmentStore';
import { isFirestoreUnavailableError } from '../lib/vendor/localVendorStore';
import { syncVendorAfterAssessmentCreate } from '../lib/vendor/syncVendorAssessment';
import { sendEmailBestEffort } from '../lib/notifications';

export function AssessmentWizard() {
  const { profile } = useAuth();
  const orgId = profile?.organizationId;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetVendorId = params.get('vendorId') || '';
  const [packDefaults, setPackDefaults] = useState<Partial<Record<FrameworkId, string>>>({});

  useEffect(() => {
    if (!orgId) return;
    void loadOrgFrameworkPackDefaults(orgId).then(setPackDefaults);
  }, [orgId]);

  const { vendors, mode: vendorMode, loading: vendorsLoading } = useOrgVendors(orgId);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [vendorId, setVendorId] = useState(presetVendorId);
  const [frameworks, setFrameworks] = useState<FrameworkId[]>(['nist_csf_2', 'soc2']);
  const [frameworkTab, setFrameworkTab] = useState<'recommended' | 'all' | 'industry' | 'custom'>(
    'recommended'
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const frameworkPackIds = useMemo(
    () => resolvePackIdsForFrameworks(frameworks, packDefaults),
    [frameworks, packDefaults]
  );

  const previewQuestions = useMemo(
    () => (frameworkPackIds.length ? buildQuestionsForPackIds(frameworkPackIds) : []),
    [frameworkPackIds]
  );

  const selected = vendors.find((v) => v.id === vendorId);
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return vendors.filter((v) => !s || v.name.toLowerCase().includes(s));
  }, [vendors, search]);

  const catalogByTab = useMemo(() => {
    const recommendedIds: FrameworkId[] = ['nist_csf_2', 'soc2', 'iso27001'];
    const industryIds: FrameworkId[] = ['hipaa', 'pci_dss_4', 'cis_controls'];
    if (frameworkTab === 'recommended') {
      return FRAMEWORK_CATALOG.filter((f) => recommendedIds.includes(f.id));
    }
    if (frameworkTab === 'industry') {
      return FRAMEWORK_CATALOG.filter((f) => industryIds.includes(f.id));
    }
    if (frameworkTab === 'custom') {
      return FRAMEWORK_CATALOG.filter((f) => f.id === 'custom');
    }
    return FRAMEWORK_CATALOG.filter((f) => f.id !== 'custom');
  }, [frameworkTab]);

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
    const questions = previewQuestions;
    const frameworkName = frameworks
      .map((id) => FRAMEWORK_CATALOG.find((f) => f.id === id)?.name || id)
      .join(', ');
    const local = createLocalAssessment(orgId, {
      vendorId,
      vendorName: selected.name,
      frameworks,
      frameworkPackIds,
      questionBankVersion: QUESTION_BANK_VERSION,
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
      const questions = previewQuestions;
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
          frameworkPackIds,
          questionBankVersion: QUESTION_BANK_VERSION,
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

      // `assessments` (above) is the sole source of truth for the active app. The old
      // best-effort dual-write to `vendor_assessments` was silently inconsistent — any
      // assessment whose legacy write failed was invisible on /vendors/legacy while
      // showing correctly everywhere else. Removed; /vendors/legacy is frozen behind the
      // `vendorsLegacy` flag today. If it's ever re-enabled, migrate VendorRisk.tsx's
      // assessment-history query to read `assessments` (where vendorId + orderBy createdAt)
      // instead of resurrecting this write.

      await syncVendorAfterAssessmentCreate(orgId, vendorId, false);

      if (selected.primaryContactEmail) {
        const portalUrl = `${window.location.origin}/portal/${ref.id}`;
        void sendEmailBestEffort({
          to: selected.primaryContactEmail,
          subject: `Security assessment request — ${selected.name}`,
          text: `Hi${selected.primaryContactName ? ` ${selected.primaryContactName}` : ''},\n\n${selected.name} has been asked to complete a security assessment (${frameworkName}).\n\nComplete it here: ${portalUrl}\n\nDue: ${due.toLocaleDateString()}\n\nYour progress saves automatically and this link stays valid until the assessment is complete.`,
        });
      }

      // Land on the org-side tracker, filtered to this vendor — the same place the
      // local-fallback path above already goes. This previously jumped to the vendor
      // portal, which is an external-facing page with no app navigation, so whoever
      // created the assessment hit a dead end with no way back. The portal link is
      // still one click away from here via "Copy Vendor Portal Link".
      navigate(`/assessments?vendorId=${encodeURIComponent(vendorId)}`);
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
              step < 3 ? 'bg-primary text-white' : 'bg-white/10 text-slate-300'
            )}
          >
            1. Vendor &amp; frameworks
          </span>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest',
              step === 3 ? 'bg-primary text-white' : 'bg-white/10 text-slate-300'
            )}
          >
            2. Preview
          </span>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {step < 3 && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
            {/* Left: vendors */}
            <aside className="flex flex-col rounded-xl border border-white/5 bg-slate-900/50">
              <div className="border-b border-white/5 p-4">
                <h2 className="text-sm font-semibold text-white">Vendor</h2>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search vendors..."
                    className="border-white/10 bg-black/20 pl-9 text-white"
                  />
                </div>
              </div>
              <div className="max-h-[28rem] space-y-1 overflow-y-auto p-2">
                {vendorsLoading && <p className="px-2 py-3 text-sm text-slate-400">Loading vendors…</p>}
                {!vendorsLoading &&
                  filtered.map((v) => {
                    const active = v.id === vendorId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVendorId(v.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm',
                          active ? 'bg-primary/20 text-white' : 'text-slate-300 hover:bg-white/5'
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-semibold">
                          {v.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{v.name}</span>
                        {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                {!vendorsLoading && filtered.length === 0 && (
                  <div className="space-y-2 px-2 py-3 text-sm text-slate-400">
                    <p>No vendors found.</p>
                    <Link to="/vendors" className="text-primary hover:underline">
                      Add a vendor first →
                    </Link>
                  </div>
                )}
              </div>
            </aside>

            {/* Right: frameworks + selected card */}
            <div className="space-y-4">
              {selected ? (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-primary">Selected vendor</p>
                      <h2 className="mt-1 text-lg font-semibold text-white">{selected.name}</h2>
                      <p className="text-sm text-slate-400">{selected.category || 'Uncategorized'}</p>
                      <p className="mt-2 text-sm text-slate-300">
                        {selected.primaryContactName || 'No contact name'}
                        {selected.primaryContactEmail ? (
                          <span className="text-slate-500"> · {selected.primaryContactEmail}</span>
                        ) : null}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                        riskBandClasses(effectiveRiskLevel(selected))
                      )}
                    >
                      {hasRealRiskScore(selected) && (
                        <>
                          <span className="tabular-nums">{displayRiskScore(selected)}</span>
                          <span className="opacity-80">·</span>
                        </>
                      )}
                      {hasRealRiskScore(selected) ? effectiveRiskLevel(selected) : 'Not assessed'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/15 bg-slate-900/40 p-4 text-sm text-slate-400">
                  Select a vendor on the left to build their assessment.
                  {presetVendorId && !selected && (
                    <span className="mt-1 block text-amber-300">
                      Preset vendor not in this org list — pick another vendor.
                    </span>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Build the right assessment</h2>
                    <p className="text-sm text-slate-400">
                      Select frameworks. GuardEntra removes duplicate questions automatically.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1 border-b border-white/5 pb-px">
                  {(
                    [
                      ['recommended', 'Recommended'],
                      ['all', 'All'],
                      ['industry', 'Industry'],
                      ['custom', 'Custom'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFrameworkTab(id)}
                      className={cn(
                        '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                        frameworkTab === id
                          ? 'border-primary text-white'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {frameworkTab === 'custom' && (
                  <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                    Custom questionnaires are coming later — you can still select the stub below; preview uses
                    the shared question bank when other frameworks are also selected.
                  </p>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {catalogByTab.map((f) => {
                    const on = frameworks.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFramework(f.id)}
                        className={cn(
                          'rounded-xl border p-4 text-left',
                          on ? 'border-primary bg-primary/15' : 'border-white/10 bg-black/20 hover:bg-white/5'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-white">{f.name}</p>
                          <span
                            className={cn(
                              'mt-0.5 h-4 w-4 shrink-0 rounded border',
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
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
              <div className="text-sm">
                <p className="font-medium text-sky-100">Smart dedupe across frameworks</p>
                <p className="text-slate-400">
                  Estimated unique set: <strong className="text-white">{uniqueQuestions}</strong> questions
                  (from {sourceQuestions} source questions across {frameworks.length} framework
                  {frameworks.length === 1 ? '' : 's'}).
                </p>
              </div>
            </div>
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
            <Button variant="outline" className="border-white/10" onClick={() => setStep(1)}>
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
