import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { PageShell } from '../spine/PageShell';

export function AssessmentsPageHeader({
  mode,
  onCreate,
  children,
  fastTrackStage = 'review',
}: {
  mode: 'firestore' | 'local';
  onCreate: () => void;
  children?: React.ReactNode;
  fastTrackStage?: 'review' | 'monitor';
}) {
  return (
    <PageShell
      eyebrow={fastTrackStage === 'monitor' ? 'FastTrack · Monitor' : 'FastTrack · Review & decide'}
      title="Assessments"
      showFastTrack
      fastTrackStage={fastTrackStage}
      description={
        <>
          {fastTrackStage === 'monitor'
            ? 'Track open conditions, remediation, and next-review dates after decisions.'
            : 'Track questionnaires, review exceptions, and record decisions.'}{' '}
          {mode === 'local' ? (
            <span className="ml-2 inline-flex rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
              Local store
            </span>
          ) : null}
        </>
      }
      actions={
        <Button onClick={onCreate} className="bg-primary text-white hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          New assessment
        </Button>
      }
    >
      {children}
    </PageShell>
  );
}

/** Compact horizontal stat strip matching Vendors. */
export function AssessmentsStatsGrid({
  stats,
}: {
  stats: { label: string; value: string | number; tone?: string }[];
}) {
  return (
    <section className="flex flex-wrap items-stretch gap-px overflow-hidden rounded-xl border border-white/8 bg-white/5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex min-w-[9rem] flex-1 flex-col justify-center bg-slate-950/60 px-4 py-3"
        >
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-slate-100">{stat.value}</p>
        </div>
      ))}
    </section>
  );
}
