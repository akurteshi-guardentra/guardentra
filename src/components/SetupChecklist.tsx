import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Circle, ClipboardList, Package, Sparkles, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { SetupChecklistItem } from '../lib/setupProgress';

const ICONS: Record<string, typeof Building2> = {
  organizationProfile: Building2,
  assessmentPacks: Package,
  firstVendor: Building2,
  firstAssessment: ClipboardList,
  inviteTeammate: Users,
};

type Props = {
  items: SetupChecklistItem[];
  /** Hide when all complete or empty. */
  hidden?: boolean;
};

export function SetupChecklist({ items, hidden }: Props) {
  const navigate = useNavigate();
  if (hidden || items.length === 0) return null;

  const primary = items.find((i) => i.primary && !i.done) || items.find((i) => !i.done);

  return (
    <Card className="border-primary/20 bg-primary/5" data-testid="setup-checklist">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Sparkles className="h-5 w-5 text-primary" />
          Get started
        </CardTitle>
        <CardDescription>
          Your GuardEntra workspace is ready. Add your first vendor to begin your third-party risk
          workflow. You can complete your organization profile and assessment-pack defaults at any
          time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {primary?.id === 'firstVendor' && (
          <Button
            type="button"
            className="h-12 w-full bg-primary text-base font-semibold text-white hover:bg-primary/90 sm:w-auto"
            onClick={() => navigate('/vendors')}
            data-testid="add-first-vendor-cta"
          >
            <Building2 className="mr-2 h-5 w-5" />
            Add your first vendor
          </Button>
        )}

        <ul className="space-y-2" aria-label="Setup checklist">
          {items.map((item) => {
            const Icon = ICONS[item.id] || Circle;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate(item.href)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                    item.done
                      ? 'border-white/5 bg-black/10 text-slate-500'
                      : item.primary
                        ? 'border-primary/40 bg-black/30 text-white hover:border-primary/60'
                        : 'border-white/10 bg-black/20 text-slate-200 hover:border-primary/30',
                  )}
                >
                  {item.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                  ) : (
                    <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  )}
                  <span className={cn('text-sm font-medium', item.done && 'line-through')}>
                    {item.label}
                  </span>
                  {item.done ? (
                    <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-500">
                      Done
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
