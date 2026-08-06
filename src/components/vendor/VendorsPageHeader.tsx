import React from 'react';
import { Mail, Plus, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { PageShell } from '../spine/PageShell';

export function VendorsPageHeader({
  dataMode,
  onOpenBulk,
  onOpenAdd,
  onOpenInvite,
  children,
}: {
  dataMode: 'firestore' | 'local';
  onOpenBulk: () => void;
  onOpenAdd: () => void;
  onOpenInvite?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <PageShell
      eyebrow="Vendor Register"
      title="Vendors"
      description={
        <>
          Manage third parties, run impact and assessment workflows, and keep the active TPRM spine in one place.
          {dataMode === 'local' ? (
            <span className="ml-2 inline-flex rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
              Local store
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5" onClick={onOpenBulk}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk upload
          </Button>
          {onOpenInvite ? (
            <Button
              variant="outline"
              className="border-white/10 text-slate-300 hover:bg-white/5"
              onClick={onOpenInvite}
            >
              <Mail className="mr-2 h-4 w-4" />
              Invite
            </Button>
          ) : null}
          <Button className="bg-primary text-white hover:bg-primary/90" onClick={onOpenAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add vendor
          </Button>
        </>
      }
    >
      {children}
    </PageShell>
  );
}

/** Compact horizontal stat strip — not four competing hero cards. */
export function VendorsStatsGrid({
  cards,
}: {
  cards: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; tone: string }[];
}) {
  return (
    <section className="flex flex-wrap items-stretch gap-px overflow-hidden rounded-xl border border-white/8 bg-white/5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex min-w-[9rem] flex-1 items-center justify-between gap-3 bg-slate-950/60 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums text-slate-100">{card.value}</p>
          </div>
          <card.icon className={card.tone} />
        </div>
      ))}
    </section>
  );
}
