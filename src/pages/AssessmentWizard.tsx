import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { Check, ChevronDown, ChevronRight, Eye, Search, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PageShell } from '../components/spine/PageShell';
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
  applyTierQuestionCap,
} from '../lib/vendor/frameworkPacks';
import { loadOrgFrameworkPackDefaults } from '../lib/vendor/orgFrameworkPacks';
import { useOrgVendors } from '../lib/vendor/useOrgVendors';
import { createLocalAssessment } from '../lib/vendor/localAssessmentStore';
import { isFirestoreUnavailableError } from '../lib/vendor/localVendorStore';
import { syncVendorAfterAssessmentCreate } from '../lib/vendor/syncVendorAssessment';
import { buildCreateAssessmentFields } from '../lib/vendor/assessmentLifecycle';
import { sendEmail } from '../lib/notifications';
import { isTriageTier, parseFrameworksParam } from '../lib/vendor/fastTrackTriage';
import { loadVendorTriage } from '../lib/vendor/vendorTriageStore';
import { emitAuditBestEffort } from '../lib/auditClient';
import {
  REMINDER_SCHEDULES,
  reminderScheduleById,
  type ReminderScheduleId,
} from '../lib/vendor/reminderSchedule';

export function AssessmentWizard() {
  const { user, profile } = useAuth();
  const orgId = profile?.organizationId;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetVendorId = params.get('vendorId') || '';
  const presetFrameworks = parseFrameworksParam(params.get('frameworks'));
  const presetTier = params.get('tier');
  const [packDefaults, setPackDefaults] = useState<Partial<Record<FrameworkId, string>>>({});
  const [activeTier, setActiveTier] = useState<string | null>(
    isTriageTier(presetTier) ? presetTier : null
  );
  const [reviewCadence, setReviewCadence] = useState<string | null>(null);
  const [dueInDays, setDueInDays] = useState(14);
  const [reminderId, setReminderId] = useState<ReminderScheduleId>('before_and_due');
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendBanner, setSendBanner] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [requesterOrgName, setRequesterOrgName] = useState('');
  const [requesterLogoUrl, setRequesterLogoUrl] = useState('');

  useEffect(() => {
    if (!orgId) return;
    void loadOrgFrameworkPackDefaults(orgId).then(setPackDefaults);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void getDoc(doc(db, 'organizations', orgId)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data() || {};
      if (typeof data.name === 'string') setRequesterOrgName(data.name);
      if (typeof data.logoUrl === 'string') setRequesterLogoUrl(data.logoUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    if (isTriageTier(presetTier)) setActiveTier(presetTier);
  }, [presetTier]);

  const { vendors, mode: vendorMode, loading: vendorsLoading } = useOrgVendors(orgId);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(
    presetVendorId && presetFrameworks.length ? 2 : presetVendorId ? 2 : 1
  );
  const [search, setSearch] = useState('');
  const [vendorId, setVendorId] = useState(presetVendorId);
  const [frameworks, setFrameworks] = useState<FrameworkId[]>(
    presetFrameworks.length ? presetFrameworks : ['nist_csf_2', 'soc2']
  );
  const [frameworkTab, setFrameworkTab] = useState<'recommended' | 'all' | 'industry' | 'custom'>(
    'recommended'
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!orgId || !vendorId || vendorId.startsWith('local_')) return;
    let cancelled = false;
    void loadVendorTriage(vendorId, orgId).then((triage) => {
      if (cancelled || !triage) return;
      if (!isTriageTier(presetTier)) setActiveTier(triage.tier);
      setReviewCadence(triage.reviewCadence);
      if (!presetFrameworks.length && triage.frameworks?.length) {
        setFrameworks((prev) => (prev.length ? prev : triage.frameworks));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, vendorId, presetTier, presetFrameworks.length]);

  const frameworkPackIds = useMemo(
    () => resolvePackIdsForFrameworks(frameworks, packDefaults),
    [frameworks, packDefaults]
  );

  const uncappedQuestions = useMemo(
    () => (frameworkPackIds.length ? buildQuestionsForPackIds(frameworkPackIds) : []),
    [frameworkPackIds]
  );

  const previewQuestions = useMemo(
    () => applyTierQuestionCap(uncappedQuestions, activeTier),
    [uncappedQuestions, activeTier]
  );

  const selected = vendors.find((v) => v.id === vendorId);

  useEffect(() => {
    if (selected?.primaryContactEmail && !inviteEmail) {
      setInviteEmail(selected.primaryContactEmail);
    }
  }, [selected?.primaryContactEmail, inviteEmail]);

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
    if (id === 'custom') return;
    setFrameworks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const continueToPreview = () => {
    const err = validateAssessmentWizard({ vendorId, frameworks });
    if (err) {
      setError(err);
      return;
    }
    if (!previewQuestions.length) {
      setError('No questions available for the selected frameworks. Pick at least one standard framework.');
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
    if (!previewQuestions.length) {
      setError('No questions available for the selected frameworks. Pick at least one standard framework.');
      return;
    }
    const due = new Date();
    due.setDate(due.getDate() + dueInDays);
    const schedule = reminderScheduleById(reminderId);
    const frameworkName = frameworks
      .map((id) => FRAMEWORK_CATALOG.find((f) => f.id === id)?.name || id)
      .join(', ');
    const fields = buildCreateAssessmentFields({
      vendorId,
      vendorName: selected.name,
      organizationId: orgId,
      frameworks,
      frameworkPackIds,
      frameworkName,
      questions: previewQuestions,
      sourceQuestionCount: sourceQuestions,
      dueAt: due.toISOString(),
      triageTier: activeTier,
      reviewCadence,
      reminderScheduleId: schedule.id,
      reminderSchedule: {
        daysBeforeDue: schedule.daysBeforeDue,
        onDue: schedule.onDue,
        daysAfterDue: schedule.daysAfterDue,
        label: schedule.label,
      },
      inviteEmail: inviteEmail || selected.primaryContactEmail || null,
      requesterOrgName: requesterOrgName || null,
      requesterLogoUrl: requesterLogoUrl || null,
    });
    const local = createLocalAssessment(orgId, {
      vendorId: fields.vendorId,
      vendorName: fields.vendorName,
      frameworks: fields.frameworks,
      frameworkPackIds: fields.frameworkPackIds,
      questionBankVersion: fields.questionBankVersion,
      frameworkName: fields.frameworkName,
      status: fields.status,
      dueAt: fields.dueAt,
      questionCount: fields.questionCount,
      sourceQuestionCount: fields.sourceQuestionCount,
      questions: fields.questions,
      requesterOrgName: fields.requesterOrgName,
      requesterLogoUrl: fields.requesterLogoUrl,
    });
    await syncVendorAfterAssessmentCreate(orgId, vendorId, true);
    void emitAuditBestEffort({
      tenantId: orgId,
      eventType: 'assessment.created',
      actorId: user?.uid || null,
      objectType: 'assessment',
      objectId: local.id,
      payload: {
        vendorId,
        frameworks,
        triageTier: activeTier,
        questionCount: fields.questionCount,
        local: true,
      },
    });
    navigate(`/assessments?vendorId=${encodeURIComponent(vendorId)}`);
    return local.id;
  };

  const createAssessment = async () => {
    const err = validateAssessmentWizard({ vendorId, frameworks });
    if (err) {
      setError(err);
      return;
    }
    if (!previewQuestions.length) {
      setError('No questions available for the selected frameworks. Pick at least one standard framework.');
      return;
    }
    if (!orgId || !selected) return;
    setSaving(true);
    setError('');
    setSendBanner(null);
    try {
      const due = new Date();
      due.setDate(due.getDate() + dueInDays);
      const schedule = reminderScheduleById(reminderId);
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

      const fields = buildCreateAssessmentFields({
        vendorId,
        vendorName: selected.name,
        organizationId: orgId,
        frameworks,
        frameworkPackIds,
        frameworkName,
        questions: previewQuestions,
        sourceQuestionCount: sourceQuestions,
        dueAt: due.toISOString(),
        triageTier: activeTier,
        reviewCadence,
        reminderScheduleId: schedule.id,
        reminderSchedule: {
          daysBeforeDue: schedule.daysBeforeDue,
          onDue: schedule.onDue,
          daysAfterDue: schedule.daysAfterDue,
          label: schedule.label,
        },
        inviteEmail: inviteEmail || selected.primaryContactEmail || null,
        requesterOrgName: requesterOrgName || null,
        requesterLogoUrl: requesterLogoUrl || null,
      });

      const ref = await Promise.race([
        addDoc(collection(db, 'assessments'), fields),
        writeTimeout,
      ]);

      await syncVendorAfterAssessmentCreate(orgId, vendorId, false);

      void emitAuditBestEffort({
        tenantId: orgId,
        eventType: 'assessment.created',
        actorId: user?.uid || null,
        objectType: 'assessment',
        objectId: ref.id,
        payload: {
          vendorId,
          frameworks,
          triageTier: activeTier,
          questionCount: fields.questionCount,
        },
      });
      void emitAuditBestEffort({
        tenantId: orgId,
        eventType: 'assessment.sent',
        actorId: user?.uid || null,
        objectType: 'assessment',
        objectId: ref.id,
        payload: {
          vendorId,
          dueAt: fields.dueAt,
          reminderScheduleId: schedule.id,
          inviteEmail: Boolean(inviteEmail || selected.primaryContactEmail),
        },
      });

      const to = (inviteEmail || selected.primaryContactEmail || '').trim();
      if (to) {
        const portalUrl = `${window.location.origin}/portal/${ref.id}`;
        try {
          await sendEmail({
            to,
            subject: `Security assessment request — ${selected.name}`,
            text: `Hi${selected.primaryContactName ? ` ${selected.primaryContactName}` : ''},\n\n${selected.name} has been asked to complete a security assessment (${frameworkName}).\n\nComplete it here: ${portalUrl}\n\nDue: ${due.toLocaleDateString()}\nReminders: ${schedule.label}\n\nYour progress saves automatically and this link stays valid until the assessment is complete.`,
          });
          setSendBanner({
            tone: 'ok',
            text: `Assessment sent. Invite queued to ${to} (needs Trigger Email + SMTP to deliver).`,
          });
        } catch (mailEx: unknown) {
          setSendBanner({
            tone: 'warn',
            text: `Assessment created; email could not be queued${mailEx instanceof Error ? ` (${mailEx.message})` : ''}.`,
          });
        }
      }

      navigate(
        `/assessments?vendorId=${encodeURIComponent(vendorId)}&created=${encodeURIComponent(ref.id)}`
      );
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
    <PageShell
      eyebrow="Assessment Builder"
      title="New assessment"
      description={
        <>
          Select a vendor, choose frameworks, then preview the questionnaire before sending.
          {vendorMode === 'local' ? (
            <span className="ml-2 inline-flex rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
              Local vendors
            </span>
          ) : null}
        </>
      }
      actions={
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
      }
    >
      <Link to="/vendors" className="text-sm text-primary hover:underline">
        ← Back to Vendors
      </Link>

      {error && <p className="text-sm text-rose-400">{error}</p>}

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
                      {activeTier && (
                        <p className="mt-2 text-xs text-emerald-300/90">
                          FastTrack <span className="font-semibold">{activeTier}</span> scope
                          (max {activeTier === 'Lite' ? 20 : activeTier === 'Standard' ? 50 : 100}{' '}
                          unique questions)
                          {' · '}
                          <Link to={`/assessments/triage?vendorId=${encodeURIComponent(vendorId)}`} className="underline">
                            Retake triage
                          </Link>
                        </p>
                      )}
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
                  <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                    Custom questionnaires are not available yet. Use Recommended / Industry frameworks —
                    selecting Custom alone is blocked because it produces an empty questionnaire.
                  </p>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {catalogByTab.map((f) => {
                    const on = frameworks.includes(f.id);
                    const disabled = f.id === 'custom';
                    return (
                      <button
                        key={f.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          toggleFramework(f.id);
                        }}
                        className={cn(
                          'rounded-xl border p-4 text-left',
                          disabled && 'cursor-not-allowed opacity-50',
                          !disabled && on && 'border-primary bg-primary/15',
                          !disabled && !on && 'border-white/10 bg-black/20 hover:bg-white/5'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-white">{f.name}</p>
                          <span
                            className={cn(
                              'mt-0.5 h-4 w-4 shrink-0 rounded border',
                              on && !disabled ? 'border-primary bg-primary' : 'border-white/20'
                            )}
                          />
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{f.description}</p>
                        <p className="mt-2 text-xs text-primary">
                          {f.questionCount ? `${f.questionCount} questions` : 'Coming later'}
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
                  {activeTier && uncappedQuestions.length > uniqueQuestions
                    ? ` (capped from ${uncappedQuestions.length} for ${activeTier})`
                    : ` (from ${sourceQuestions} source questions across ${frameworks.length} framework${frameworks.length === 1 ? '' : 's'})`}
                  .
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
            <Button variant="outline" className="border-white/10" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              onClick={() => {
                setError('');
                setStep(4);
              }}
            >
              Continue to Send
            </Button>
          </div>
        </div>
      )}

      {step === 4 && selected && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Send assessment</h2>
            <p className="text-sm text-slate-400">
              Confirm recipient, due date, and reminder schedule. Sending locks the question snapshot.
            </p>
          </div>

          <div className="grid gap-4 rounded-xl border border-white/10 bg-slate-900/50 p-5 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Recipient email</span>
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="vendor@example.com"
                className="mt-2 border-white/10 bg-black/20 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Due in (days)</span>
              <Input
                type="number"
                min={1}
                max={180}
                value={dueInDays}
                onChange={(e) => setDueInDays(Math.max(1, Number(e.target.value) || 14))}
                className="mt-2 border-white/10 bg-black/20 text-white"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Reminder schedule</span>
              <select
                value={reminderId}
                onChange={(e) => setReminderId(e.target.value as ReminderScheduleId)}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-slate-200"
              >
                {REMINDER_SCHEDULES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Automatic reminders need Trigger Email + SMTP (see docs/ENVIRONMENTS.md). Manual reminders still work from the tracker.
              </p>
            </label>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Email preview</p>
            <p className="mt-2 font-medium text-slate-100">
              Security assessment request — {selected.name}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-slate-400">
              {`${selected.name} has been asked to complete a security assessment (${frameworks
                .map((id) => FRAMEWORK_CATALOG.find((f) => f.id === id)?.name || id)
                .join(', ')}).\n\nDue in ${dueInDays} day(s). Reminders: ${reminderScheduleById(reminderId).label}.\n\nPortal link will be included on send.`}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {uniqueQuestions} questions locked on send · {activeTier || 'Custom'} scope
            </p>
          </div>

          {sendBanner && (
            <p
              className={
                sendBanner.tone === 'ok' ? 'text-sm text-emerald-300' : 'text-sm text-amber-200'
              }
            >
              {sendBanner.text}
            </p>
          )}
          {error && <p className="text-sm text-rose-300">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" className="border-white/10" onClick={() => setStep(3)}>
              Back to review
            </Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              disabled={saving}
              onClick={() => void createAssessment()}
            >
              {saving ? 'Sending…' : 'Send assessment'}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
