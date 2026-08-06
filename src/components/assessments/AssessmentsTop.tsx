import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { PageShell } from '../spine/PageShell';

export function AssessmentsPageHeader({
  mode,
  onCreate,
  children,
}: {
  mode: 'firestore' | 'local';
  onCreate: () => void;
  children?: React.ReactNode;
}) {
  return (
    <PageShell
      eyebrow="Assessment Tracker"
      title="Structured Assessments"
      description={
        <>
          Run framework questionnaires, share the vendor portal, and review vendor responses in one tracker.
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

export function AssessmentsStatsGrid({
  stats,
}: {
  stats: { label: string; value: string | number; tone: string }[];
}) {
  return (
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="flex flex-col items-center justify-center border-white/8 bg-slate-900/45 p-5 text-center"
        >
          <Badge variant="outline" className={stat.tone}>
            {stat.label}
          </Badge>
          <div className="mt-3 text-3xl font-bold text-white">{stat.value}</div>
        </Card>
      ))}
    </section>
  );
}
