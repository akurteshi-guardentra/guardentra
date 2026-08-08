import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/button';
import { PageShell } from '../components/spine/PageShell';
import { cn } from '../lib/utils';
import { FRAMEWORK_CATALOG } from '../lib/vendor/constants';
import { useOrgVendors } from '../lib/vendor/useOrgVendors';
import {
  EMPTY_TRIAGE_ANSWERS,
  TRIAGE_QUESTIONS,
  frameworksToParam,
  isTriageComplete,
  nextReviewAtFromCadence,
  recommendFromTriage,
  type TriageAnswers,
} from '../lib/vendor/fastTrackTriage';
import { saveVendorTriage } from '../lib/vendor/vendorTriageStore';
import { emitAuditBestEffort } from '../lib/auditClient';

export function FastTrackTriage() {
  const { user, profile } = useAuth();
  const orgId = profile?.organizationId;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetVendorId = params.get('vendorId') || '';
  const { vendors, loading } = useOrgVendors(orgId);

  const [vendorId, setVendorId] = useState(presetVendorId);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<TriageAnswers>({ ...EMPTY_TRIAGE_ANSWERS });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  // Keep local vendor selection in sync when arriving from Vendors “Assess” links.
  useEffect(() => {
    if (presetVendorId) setVendorId(presetVendorId);
  }, [presetVendorId]);

  const selected = vendors.find((v) => v.id === vendorId);
  const recommendation = useMemo(() => recommendFromTriage(answers), [answers]);
  const question = step < TRIAGE_QUESTIONS.length ? TRIAGE_QUESTIONS[step] : null;
  const showingResult = step >= TRIAGE_QUESTIONS.length;

  const toggleMulti = (field: 'dataExposure' | 'requirements', value: string) => {
    setAnswers((prev) => {
      const current = prev[field] as string[];
      if (field === 'requirements' && value === 'none') {
        return { ...prev, requirements: ['none'] };
      }
      if (field === 'requirements') {
        const withoutNone = current.filter((v) => v !== 'none');
        const next = withoutNone.includes(value)
          ? withoutNone.filter((v) => v !== value)
          : [...withoutNone, value];
        return { ...prev, requirements: next.length ? next : ['none'] } as TriageAnswers;
      }
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [field]: next } as TriageAnswers;
    });
  };

  const setSingle = (
    field: 'accessLevel' | 'businessCriticality' | 'reviewCadence',
    value: string
  ) => {
    setAnswers((prev) => ({ ...prev, [field]: value }) as TriageAnswers);
  };

  const canAdvance = (): boolean => {
    if (!question) return false;
    if (question.id === 'dataExposure') return answers.dataExposure.length > 0;
    if (question.id === 'accessLevel') return answers.accessLevel !== null;
    if (question.id === 'businessCriticality') return answers.businessCriticality !== null;
    if (question.id === 'requirements') return answers.requirements.length > 0;
    if (question.id === 'reviewCadence') return answers.reviewCadence !== null;
    return false;
  };

  const goNext = () => {
    if (step < TRIAGE_QUESTIONS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    setStep(TRIAGE_QUESTIONS.length);
  };

  const acceptRecommendation = async () => {
    if (!vendorId || !recommendation || !orgId) return;
    setAccepting(true);
    setAcceptError('');
    const completedAt = new Date().toISOString();
    try {
      await saveVendorTriage({
        organizationId: orgId,
        vendorId,
        answers,
        tier: recommendation.tier,
        frameworks: recommendation.frameworks,
        rationale: recommendation.rationale,
        questionTarget: recommendation.questionTarget,
        vendorTimeTarget: recommendation.vendorTimeTarget,
        reviewCadence: answers.reviewCadence,
        completedAt,
        completedBy: user?.uid || null,
      });

      const nextReviewAt = nextReviewAtFromCadence(answers.reviewCadence);
      if (nextReviewAt && !vendorId.startsWith('local_')) {
        try {
          await updateDoc(doc(db, 'vendors', vendorId), { nextReviewAt });
        } catch {
          /* local / offline vendors skip cloud stamp */
        }
      }

      void emitAuditBestEffort({
        tenantId: orgId,
        eventType: 'triage.completed',
        actorId: user?.uid || null,
        objectType: 'vendor',
        objectId: vendorId,
        payload: {
          tier: recommendation.tier,
          frameworks: recommendation.frameworks,
          rationale: recommendation.rationale,
          reviewCadence: answers.reviewCadence,
          dataExposure: answers.dataExposure,
          accessLevel: answers.accessLevel,
          businessCriticality: answers.businessCriticality,
          requirements: answers.requirements,
        },
      });

      const qs = new URLSearchParams({
        vendorId,
        frameworks: frameworksToParam(recommendation.frameworks),
        tier: recommendation.tier,
      });
      navigate(`/assessments/new?${qs.toString()}`);
    } catch (ex: unknown) {
      setAcceptError(ex instanceof Error ? ex.message : 'Failed to save triage.');
    } finally {
      setAccepting(false);
    }
  };

  const openAdvanced = () => {
    if (!vendorId) return;
    navigate(`/assessments/new?vendorId=${encodeURIComponent(vendorId)}`);
  };

  return (
    <PageShell
      eyebrow="FastTrack"
      title="Risk triage"
      description="Answer five relationship questions so Guardentra can recommend Lite, Standard, or Enhanced scope in about 60 seconds."
      className="max-w-4xl"
    >
      <div className="flex items-center gap-3">
        <Link
          to={vendorId ? `/vendors/${vendorId}/impact` : '/vendors'}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      {(!presetVendorId || !vendorId) && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Vendor</label>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Loading vendors…</p>
          ) : (
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-slate-200"
            >
              <option value="">Select a vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {presetVendorId && loading && (
        <p className="text-sm text-slate-500">Loading vendor…</p>
      )}

      {presetVendorId && !loading && !selected && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">Vendor not found in this organization</p>
          <p className="mt-1 text-amber-100/80">
            The link may be stale, or the vendor belongs to another workspace. Pick a vendor below or
            return to the register.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="border-white/10" onClick={() => navigate('/vendors')}>
              Back to Vendors
            </Button>
            <Button type="button" variant="ghost" className="text-slate-300" onClick={() => setVendorId('')}>
              Choose another vendor
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-slate-200">
          Triaging <span className="font-medium text-slate-50">{selected.name}</span>
          {selected.category ? ` · ${selected.category}` : ''}
        </div>
      )}

      {!vendorId ? (
        <p className="text-sm text-slate-500">Select a vendor to start triage.</p>
      ) : presetVendorId && !loading && !selected ? null : showingResult && recommendation ? (
        <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-slate-50">
                Recommended: {recommendation.tier}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                About {recommendation.questionTarget} unique questions · vendor target{' '}
                {recommendation.vendorTimeTarget}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {recommendation.rationale.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-slate-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {line}
              </li>
            ))}
          </ul>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Frameworks</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendation.frameworks.map((id) => {
                const name = FRAMEWORK_CATALOG.find((f) => f.id === id)?.name || id;
                return (
                  <span
                    key={id}
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-slate-200"
                  >
                    {name}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" disabled={accepting} onClick={() => void acceptRecommendation()}>
              {accepting ? 'Saving…' : 'Use this assessment'}
            </Button>
            <Button type="button" variant="outline" className="border-white/10" onClick={openAdvanced}>
              Advanced frameworks
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400"
              onClick={() => setStep(0)}
            >
              Retake triage
            </Button>
          </div>
          {acceptError ? <p className="text-sm text-rose-300">{acceptError}</p> : null}
        </div>
      ) : showingResult && !recommendation ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <p className="text-sm text-slate-400">
            Could not build a recommendation yet. Go back and finish every question.
          </p>
          <Button type="button" onClick={() => setStep(Math.max(0, TRIAGE_QUESTIONS.length - 1))}>
            Resume triage
          </Button>
        </div>
      ) : question ? (
          <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                Question {step + 1} of {TRIAGE_QUESTIONS.length}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">About 60 seconds</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${((step + 1) / TRIAGE_QUESTIONS.length) * 100}%` }}
              />
            </div>

            <div>
              <h2 className="text-lg font-medium text-slate-50">{question.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{question.hint}</p>
            </div>

            <div className="space-y-2">
              {question.options.map((opt) => {
                const selectedOpt = question.multi
                  ? (answers[question.id] as string[]).includes(opt.value)
                  : answers[question.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (question.multi) {
                        toggleMulti(question.id as 'dataExposure' | 'requirements', opt.value);
                      } else {
                        setSingle(
                          question.id as 'accessLevel' | 'businessCriticality' | 'reviewCadence',
                          opt.value
                        );
                      }
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                      selectedOpt
                        ? 'border-primary bg-primary/15 text-slate-50'
                        : 'border-white/10 bg-black/20 text-slate-300 hover:bg-white/5'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        question.multi ? 'rounded-sm' : 'rounded-full',
                        selectedOpt ? 'border-primary bg-primary' : 'border-white/20'
                      )}
                    >
                      {selectedOpt && <Check className="h-3 w-3 text-white" />}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {step > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-400"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </Button>
              )}
              <Button type="button" disabled={!canAdvance()} onClick={goNext} className="ml-auto">
                {step === TRIAGE_QUESTIONS.length - 1 ? 'Generate recommendation' : 'Next question'}
              </Button>
            </div>

            {!isTriageComplete(answers) && step === TRIAGE_QUESTIONS.length - 1 && (
              <p className="text-xs text-slate-500">Answer every question to generate a recommendation.</p>
            )}
          </div>
      ) : (
        <p className="text-sm text-slate-500">Preparing triage…</p>
      )}
    </PageShell>
  );
}
