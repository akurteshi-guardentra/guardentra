import React from 'react';
import { cn } from '../../lib/utils';

export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-6xl space-y-8 animate-in fade-in duration-500', className)}>
      <section className="rounded-3xl border border-white/8 bg-slate-900/45 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-sm md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            {eyebrow ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">{eyebrow}</p>
            ) : null}
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">{title}</h1>
              {description ? <div className="text-sm leading-6 text-slate-400 md:text-base">{description}</div> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
        </div>
      </section>
      {children}
    </div>
  );
}

export function PageBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-white/8 bg-slate-900/45 p-4 md:p-5', className)}>
      {children}
    </section>
  );
}
