import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

/**
 * FastTrack / TPR journey chrome (Drive: Third-party risk + Phase 2 gap diagram).
 * Collapses the 8-step TPR diagram into the six product stages used in-app.
 */
export type FastTrackStageId =
  | 'vendors'
  | 'triage'
  | 'wizard'
  | 'portal'
  | 'review'
  | 'monitor';

const STAGES: {
  id: FastTrackStageId;
  n: number;
  label: string;
  href?: string;
}[] = [
  { id: 'vendors', n: 1, label: 'Add vendor', href: '/vendors' },
  { id: 'triage', n: 2, label: 'Triage', href: '/assessments/triage' },
  { id: 'wizard', n: 3, label: 'Build & send', href: '/assessments/new' },
  { id: 'portal', n: 4, label: 'Vendor portal' },
  { id: 'review', n: 5, label: 'Review & decide', href: '/assessments' },
  { id: 'monitor', n: 6, label: 'Monitor', href: '/assessments?focus=monitor' },
];

export function resolveFastTrackStage(pathname: string, search = ''): FastTrackStageId {
  if (pathname.startsWith('/portal')) return 'portal';
  if (pathname.startsWith('/assessments/triage')) return 'triage';
  if (pathname.startsWith('/assessments/new')) return 'wizard';
  if (pathname.startsWith('/assessments')) {
    return search.includes('focus=monitor') ? 'monitor' : 'review';
  }
  if (pathname.startsWith('/vendors')) return 'vendors';
  return 'vendors';
}

export function FastTrackStageBar({
  current,
  vendorId,
}: {
  current?: FastTrackStageId;
  /** When set, triage/wizard links keep the vendor context. */
  vendorId?: string;
}) {
  const location = useLocation();
  const active = current || resolveFastTrackStage(location.pathname, location.search);
  const activeIdx = STAGES.findIndex((s) => s.id === active);

  const hrefFor = (stage: (typeof STAGES)[number]) => {
    if (!stage.href) return undefined;
    if (vendorId && (stage.id === 'triage' || stage.id === 'wizard')) {
      const base = stage.href;
      const join = base.includes('?') ? '&' : '?';
      return `${base}${join}vendorId=${encodeURIComponent(vendorId)}`;
    }
    return stage.href;
  };

  return (
    <nav
      aria-label="FastTrack stages"
      className="overflow-x-auto rounded-xl border border-white/8 bg-slate-950/60 px-2 py-2"
    >
      <ol className="flex min-w-max items-center gap-1">
        {STAGES.map((stage, idx) => {
          const isCurrent = stage.id === active;
          const isDone = idx < activeIdx;
          const href = hrefFor(stage);
          const className = cn(
            'inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
            isCurrent && 'bg-primary/15 text-white ring-1 ring-primary/40',
            isDone && !isCurrent && 'text-slate-300',
            !isDone && !isCurrent && 'text-slate-500'
          );
          const inner = (
            <>
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                  isCurrent && 'bg-primary text-white',
                  isDone && !isCurrent && 'bg-emerald-500/20 text-emerald-300',
                  !isDone && !isCurrent && 'bg-white/5 text-slate-500'
                )}
              >
                {stage.n}
              </span>
              <span className="whitespace-nowrap font-medium">{stage.label}</span>
            </>
          );
          return (
            <li key={stage.id} className="flex items-center gap-1">
              {idx > 0 ? (
                <span className="mx-0.5 hidden h-px w-4 bg-white/10 sm:block" aria-hidden />
              ) : null}
              {href && !isCurrent ? (
                <Link to={href} className={className}>
                  {inner}
                </Link>
              ) : (
                <span className={className} aria-current={isCurrent ? 'step' : undefined}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
