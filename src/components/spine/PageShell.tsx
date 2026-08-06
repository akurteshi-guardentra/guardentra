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
    <div className={cn('mx-auto max-w-6xl space-y-6 animate-in fade-in duration-500', className)}>
      <header className="flex flex-col gap-4 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-50 md:text-4xl">{title}</h1>
          {description ? <div className="text-sm leading-6 text-slate-400">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

/** Single bordered main surface for filters + table (avoids double-card with PageShell). */
export function PageBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-white/8 bg-slate-900/40', className)}>
      {children}
    </section>
  );
}
