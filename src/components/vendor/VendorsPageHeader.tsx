import React from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { PageShell } from '../spine/PageShell';

export function VendorsPageHeader({
  dataMode,
  onOpenBulk,
  onOpenAdd,
  children,
}: {
  dataMode: 'firestore' | 'local';
  onOpenBulk: () => void;
  onOpenAdd: () => void;
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

export function VendorsStatsGrid({
  cards,
}: {
  cards: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; tone: string }[];
}) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-white/8 bg-slate-900/45 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
              <p className="mt-3 font-display text-3xl font-bold text-white">{card.value}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <card.icon className={card.tone} />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
