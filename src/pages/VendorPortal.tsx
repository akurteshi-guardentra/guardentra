import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { signInWithCustomToken } from 'firebase/auth';
import { 
  Shield, 
  CheckCircle2, 
  Upload, 
  Send, 
  Loader2, 
  AlertTriangle,
  Lock,
  Save,
  FileText,
  X,
  Circle,
  Clock,
  Download,
} from 'lucide-react';
import { db } from '../firebase';
import { getPortalAuth } from '../lib/vendor/portalAuth';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import type { AnswerValue } from '../lib/vendor/types';
import { CheckSquare, Square } from 'lucide-react';
import {
  categoryProgress,
  isAnswered,
  overallProgressPct,
  QUESTION_CATEGORIES,
  type PortalQuestion,
} from '../lib/vendor/questionBank';
import { uploadPortalEvidence, type UploadedEvidence } from '../lib/vendor/evidenceUpload';
import { syncVendorAfterAssessmentProgress, syncVendorAfterAssessmentSubmit } from '../lib/vendor/syncVendorAssessment';
import {
  buildPortalAutosavePatch,
  buildPortalSubmitPatch,
} from '../lib/vendor/assessmentLifecycle';

type AnswersMap = Record<string, AnswerValue | string | string[] | undefined>;
type CommentsMap = Record<string, string>;
type EvidenceMap = Record<string, UploadedEvidence[]>;

export function VendorPortal() {
  const { assessmentId } = useParams();
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<PortalQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(QUESTION_CATEGORIES[0]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [comments, setComments] = useState<CommentsMap>({});
  const [evidence, setEvidence] = useState<EvidenceMap>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [started, setStarted] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    /**
     * Establish a session scoped to THIS assessment before reading anything.
     *
     * Previously this was a fire-and-forget signInAnonymously() in its own effect,
     * racing the fetch below. That session carried no notion of which assessment it
     * was for, so one portal link could reach every other open assessment's data and
     * evidence (docs/KNOWN_ISSUES.md #17 — confirmed live, not theoretical). The
     * server now mints a token carrying a portalAssessmentId claim, and the rules
     * compare it against the id in the path.
     *
     * The sequencing is load-bearing: the rules check that claim, so a read issued
     * before sign-in resolves is denied rather than merely unauthenticated.
     */
    const startPortalSession = async () => {
      const res = await fetch('/api/portal/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId }),
      });
      if (!res.ok) {
        throw new Error(`Portal session request failed (${res.status})`);
      }
      const { token } = (await res.json()) as { token?: string };
      if (!token) throw new Error('Portal session response contained no token');
      await signInWithCustomToken(getPortalAuth(), token);
    };

    const fetchAssessment = async () => {
      if (!assessmentId) {
        setIsLoading(false);
        return;
      }
      try {
        await startPortalSession();
      } catch (err) {
        // Closed, unknown, or rate-limited link — leave `assessment` null so the
        // existing "Portal link invalid" screen renders. No new UI state needed.
        console.error('Failed to start portal session', err);
        setIsLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'assessments', assessmentId));
        if (!snap.exists()) {
          setIsLoading(false);
          return;
        }
        const data = { id: snap.id, ...snap.data() } as any;
        setAssessment(data);

        let qs: PortalQuestion[] = [];
        if (Array.isArray(data.questions) && data.questions.length) {
          qs = data.questions.map((q: any, i: number) => ({
            id: q.id || `q_${i + 1}`,
            controlKey: q.controlKey || q.id || `legacy_q_${i + 1}`,
            category: q.category || 'Company Profile',
            question: q.question || q.text || 'Untitled question',
            type: (q.type as PortalQuestion['type']) || 'yesno',
            options: (q.options as AnswerValue[]) || ['Yes', 'No', 'Partially', 'Not Applicable'],
            required: q.required !== false,
          }));
        }
        // Do not rebuild from the live bank — empty snapshot means a broken/legacy
        // assessment; silent rebuild would mutate historical question identity.

        setQuestions(qs);
        if (data.answers) setAnswers(data.answers);
        if (data.comments) setComments(data.comments);
        if (data.evidenceByQuestion) setEvidence(data.evidenceByQuestion);
        if (data.progressPct > 0 || data.progress > 0) setStarted(true);
        if (qs.length) setActiveCategory(qs[0].category);
      } catch (err) {
        console.error('Failed to load assessment', err);
      } finally {
      setIsLoading(false);
      }
    };
    fetchAssessment();
  }, [assessmentId]);

  const categoryQs = useMemo(
    () => questions.filter((q) => q.category === activeCategory),
    [questions, activeCategory]
  );

  const currentQuestion = categoryQs[questionIndex] || categoryQs[0];
  const progress = overallProgressPct(questions, answers);
  const catStats = categoryProgress(questions, answers);

  const persistDraft = useCallback(
    async (nextAnswers: AnswersMap, nextComments: CommentsMap, nextEvidence: EvidenceMap) => {
      if (!assessmentId || !assessment) return;
      setSaveState('saving');
      try {
        // Never mark Completed on autosave — Submit moves to Under Review; org signs off.
        const patch = buildPortalAutosavePatch({
          questions,
          answers: nextAnswers,
          comments: nextComments,
          evidenceByQuestion: nextEvidence,
        });
        await updateDoc(doc(db, 'assessments', assessmentId), patch);
        if (patch.progressPct > 0 && assessment.vendorId && assessment.organizationId) {
          void syncVendorAfterAssessmentProgress(
            assessment.organizationId,
            assessment.vendorId,
            false
          );
        }
        setSaveState('saved');
      } catch (err) {
        console.error(err);
        setSaveState('error');
      }
    },
    [assessmentId, assessment, questions]
  );

  const scheduleSave = useCallback(
    (nextAnswers: AnswersMap, nextComments: CommentsMap, nextEvidence: EvidenceMap) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persistDraft(nextAnswers, nextComments, nextEvidence);
      }, 600);
    },
    [persistDraft]
  );

  const setAnswer = (questionId: string, value: AnswerValue | string | string[]) => {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    scheduleSave(next, comments, evidence);
  };

  const toggleMultiChoice = (questionId: string, option: string) => {
    const current = answers[questionId];
    const selected = Array.isArray(current) ? current : [];
    const next = selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option];
    setAnswer(questionId, next);
  };

  const setComment = (questionId: string, value: string) => {
    const next = { ...comments, [questionId]: value };
    setComments(next);
    scheduleSave(answers, next, evidence);
  };

  const handleUpload = async (file: File) => {
    if (!currentQuestion || !assessmentId) return;
    setUploadError('');
    setUploading(true);
    try {
      const uploaded = await uploadPortalEvidence({
        orgId: assessment?.organizationId || '',
        vendorId: assessment?.vendorId || assessmentId,
        assessmentId,
        file,
        questionId: currentQuestion.id,
      });
      const list = [...(evidence[currentQuestion.id] || []), uploaded];
      const next = { ...evidence, [currentQuestion.id]: list };
      setEvidence(next);
      scheduleSave(answers, comments, next);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Check Storage rules / anonymous auth.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!assessmentId) return;
    const missing = questions.filter((q) => q.required && !isAnswered(answers[q.id]));
    if (missing.length) {
      setUploadError(`Answer all required questions (${missing.length} remaining).`);
      return;
    }
    setIsSubmitting(true);
    try {
      const patch = buildPortalSubmitPatch({
        answers,
        comments,
        evidenceByQuestion: evidence,
      });
      await updateDoc(doc(db, 'assessments', assessmentId), patch);
      if (assessment?.organizationId && assessment?.vendorId) {
        void syncVendorAfterAssessmentSubmit(assessment.organizationId, assessment.vendorId, false);
      }
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      setUploadError('Submission failed. The portal link may not have write access yet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = () => {
    if (questionIndex < categoryQs.length - 1) {
      setQuestionIndex(questionIndex + 1);
      return;
    }
    const catIdx = QUESTION_CATEGORIES.indexOf(activeCategory as any);
    for (let i = catIdx + 1; i < QUESTION_CATEGORIES.length; i++) {
      const nextCat = QUESTION_CATEGORIES[i];
      if (questions.some((q) => q.category === nextCat)) {
        setActiveCategory(nextCat);
        setQuestionIndex(0);
        return;
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
        <p className="text-sm text-slate-500">Loading secure questionnaire…</p>
      </div>
    );
  }

  if (!assessment || isSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center">
          {isSuccess ? (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
              <h1 className="text-2xl font-semibold text-white">Submission received</h1>
              <p className="mt-2 text-sm text-slate-400">
                Thank you. Your security assessment was submitted for review.
              </p>
              <p className="mt-4 font-mono text-xs text-slate-400">Ref: {assessmentId}</p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
                <AlertTriangle className="h-7 w-7 text-rose-400" />
                </div>
              <h1 className="text-2xl font-semibold text-white">Portal link invalid</h1>
              <p className="mt-2 text-sm text-slate-400">
                This assessment could not be found or the link has expired.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Questionnaire unavailable</h1>
          <p className="mt-2 text-sm text-slate-400">
            This assessment has no snapshotted questions. Ask the requesting organization to
            recreate it so the framework pack is stamped correctly.
          </p>
        </div>
      </div>
    );
  }

  if (!started) {
    const due = assessment.dueAt || assessment.dueDate;
    const dueLabel = due
      ? new Date(due).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
    const ring = 2 * Math.PI * 36;
    const ringOffset = ring - (progress / 100) * ring;
    const downloadInstructions = () => {
      const body = [
        'GuardEntra Vendor Assessment — Instructions',
        '',
        `Vendor: ${assessment.vendorName || 'Vendor'}`,
        `Questions: ${questions.length}`,
        `Due: ${dueLabel}`,
        '',
        '1. Click Start Questionnaire and answer Yes / No / Partially / N/A.',
        '2. Add optional context and upload evidence (PDF, DOCX, XLSX, PNG, JPG).',
        '3. Progress autosaves — you can leave and return with this link.',
        '4. Submit when all required questions are complete.',
      ].join('\n');
      const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'guardentra-assessment-instructions.txt';
      a.click();
      URL.revokeObjectURL(url);
    };
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="rounded-lg bg-primary/20 border border-primary/40 p-2">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-white">GuardEntra Vendor Portal</p>
              <p className="text-xs text-slate-500">Encrypted questionnaire</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl p-6 lg:p-10">
          <div className="grid gap-6 rounded-2xl border border-white/10 bg-slate-900/50 p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm text-slate-500">Security &amp; Compliance Assessment</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-white text-glow">
                {assessment.vendorName || 'Vendor'} questionnaire
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Requested for your organization · {questions.length} unique questions
                {assessment.sourceQuestionCount
                  ? ` (deduplicated from ${assessment.sourceQuestionCount} source questions)`
                  : ''}
              </p>
              <div className="mt-6 flex flex-wrap gap-6 text-sm text-slate-400">
                <span>
                  Due: <strong className="text-slate-200">{dueLabel}</strong>
                </span>
                <span>Est. 25–35 minutes</span>
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Responses encrypted in transit
                </span>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button className="bg-primary text-white hover:bg-primary/90" onClick={() => setStarted(true)}>
                  Start Questionnaire
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 text-slate-300"
                  onClick={downloadInstructions}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download instructions
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Save and return anytime · Upload supporting evidence · Invite a colleague (soon)
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="relative h-28 w-28">
                <svg className="h-28 w-28 -rotate-90" viewBox="0 0 80 80" aria-hidden>
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={ring}
                    strokeDashoffset={ringOffset}
                    className="text-primary transition-all"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-white">{progress}%</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">Progress</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Position in the order the vendor actually walks the questionnaire (category by
  // category, per QUESTION_CATEGORIES), not the raw stored array order. New assessments
  // are already built in this order, but ones created before that fix have the
  // rich-answer-type questions grouped at the end, which made this counter jump
  // (…14, then 49). Ordering here keeps those existing assessments correct too.
  const orderedQuestions = QUESTION_CATEGORIES.flatMap((cat) =>
    questions.filter((q) => q.category === cat)
  ).concat(questions.filter((q) => !QUESTION_CATEGORIES.includes(q.category as any)));
  const globalIndex = orderedQuestions.findIndex((q) => q.id === currentQuestion?.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-white">{assessment.vendorName || 'Vendor'} assessment</p>
              <p className="text-xs font-medium tabular-nums text-slate-400">
                Question {Math.max(1, globalIndex + 1)} of {questions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden w-40 sm:block">
              <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <span className="text-xs text-slate-500">
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && 'Saved'}
              {saveState === 'error' && 'Save failed'}
              {saveState === 'idle' && (
                <span className="inline-flex items-center gap-1">
                  <Save className="h-3 w-3" /> Autosave on
                </span>
              )}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[240px_1fr] lg:p-6">
        <aside className="h-fit space-y-1 rounded-xl border border-white/5 bg-slate-900/50 p-3">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Categories</p>
          {QUESTION_CATEGORIES.map((cat) => {
            const stats = catStats[cat];
            if (!stats.total) return null;
            const done = stats.answered === stats.total;
            const inProgress = stats.answered > 0 && !done;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat);
                  setQuestionIndex(0);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm',
                  activeCategory === cat
                    ? 'border border-primary/30 bg-primary/15 text-white'
                    : 'text-slate-300 hover:bg-white/5'
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : inProgress ? (
                  <Clock className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                )}
                <span className="min-w-0 flex-1 truncate">{cat}</span>
                <span
                  className={cn(
                    'shrink-0 text-[10px] font-medium uppercase',
                    done ? 'text-emerald-400' : inProgress ? 'text-sky-400' : 'text-slate-500'
                  )}
                >
                  {done ? 'Complete' : inProgress ? 'In progress' : 'Not started'}
                </span>
              </button>
            );
          })}
        </aside>

        <main className="space-y-4">
          {currentQuestion && (
            <div className="rounded-xl border border-white/5 bg-slate-900/50 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {currentQuestion.category}
                </p>
                <p className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-medium tabular-nums text-slate-300">
                  Question {Math.max(1, globalIndex + 1)} of {questions.length}
                </p>
              </div>
              <h2 className="text-xl font-semibold leading-snug text-white">{currentQuestion.question}</h2>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {currentQuestion.options.map((option) => {
                  const isMulti = currentQuestion.type === 'multiple_choice';
                  const currentValue = answers[currentQuestion.id];
                  const selected = isMulti
                    ? Array.isArray(currentValue) && currentValue.includes(option)
                    : currentValue === option;
                  const isNo = !isMulti && option === 'No';
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        isMulti
                          ? toggleMultiChoice(currentQuestion.id, option)
                          : setAnswer(currentQuestion.id, option)
                      }
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium transition',
                        selected
                          ? isNo
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                            : 'border-primary bg-primary/20 text-white'
                          : 'border-white/10 text-slate-300 hover:bg-white/5'
                      )}
                    >
                      {isMulti &&
                        (selected ? (
                          <CheckSquare className="h-4 w-4 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0" />
                        ))}
                      {option}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6">
                <label className="text-xs font-medium text-slate-400">
                  Add context for your response (optional)
                </label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  value={comments[currentQuestion.id] || ''}
                  onChange={(e) => setComment(currentQuestion.id, e.target.value)}
                  maxLength={2000}
                  placeholder="Explain controls, exceptions, or compensating measures…"
                />
              </div>

              <div className="mt-6">
                <p className="text-xs font-medium text-slate-400">Supporting evidence (optional)</p>
                <p className="text-xs text-slate-500">PDF, DOCX, XLSX, PNG, JPG · max 25MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-8 text-sm text-slate-400 hover:border-primary/40 hover:bg-white/5"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-primary" />}
                  {uploading ? 'Uploading…' : 'Click to upload or drag and drop'}
                </button>
                {(evidence[currentQuestion.id] || []).map((f) => (
                  <div
                    key={f.storagePath}
                    className="mt-2 flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <a
                        href={f.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary hover:underline"
                      >
                        {f.fileName}
                      </a>
                    </span>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-400"
                      onClick={() => {
                        const list = (evidence[currentQuestion.id] || []).filter(
                          (x) => x.storagePath !== f.storagePath
                        );
                        const next = { ...evidence, [currentQuestion.id]: list };
                        setEvidence(next);
                        scheduleSave(answers, comments, next);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {uploadError && <p className="mt-2 text-sm text-rose-400">{uploadError}</p>}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
                <Button
                  variant="outline"
                  className="border-white/10 text-slate-300"
                  disabled={questionIndex === 0 && QUESTION_CATEGORIES.indexOf(activeCategory as any) <= 0}
                  onClick={() => {
                    if (questionIndex > 0) setQuestionIndex(questionIndex - 1);
                    else {
                      const catIdx = QUESTION_CATEGORIES.indexOf(activeCategory as any);
                      for (let i = catIdx - 1; i >= 0; i--) {
                        if (questions.some((q) => q.category === QUESTION_CATEGORIES[i])) {
                          setActiveCategory(QUESTION_CATEGORIES[i]);
                          const len = questions.filter((q) => q.category === QUESTION_CATEGORIES[i]).length;
                          setQuestionIndex(Math.max(0, len - 1));
                          break;
                        }
                      }
                    }
                  }}
                >
                  Previous
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="border-white/10 text-slate-300"
                    onClick={() => void persistDraft(answers, comments, evidence)}
                  >
                    Save Draft
                  </Button>
                  {globalIndex >= questions.length - 1 ? (
                    <Button
                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                      disabled={isSubmitting}
                      onClick={() => void handleSubmit()}
                    >
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Submit
                    </Button>
                  ) : (
                    <Button className="bg-primary text-white hover:bg-primary/90" onClick={goNext}>
                      Next Question
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="text-center text-xs text-slate-400">
            Progress saves automatically · Your responses are encrypted in transit
          </p>
        </main>
      </div>
    </div>
  );
}
