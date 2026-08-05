import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/src/components/ui/card';
import { useAuth } from '../lib/AuthContext';
import { authHeaders } from '../lib/authHeaders';
import { SUPPORT_MAILTO } from '../lib/brand';

// Tier sketch per docs/ARCHITECTURE_FOUNDATION.md §4 — Vendor TPRM spine framing,
// not a generic GRC suite. List prices are Guardentra starter proposals.
const plans = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'The vendor TPRM spine for teams getting off spreadsheets.',
    price: { monthly: 149, annually: 1490 },
    features: [
      'Up to 25 vendors',
      '3 seats',
      'Vendor questionnaire portal + evidence',
      'Audit Lab (1 framework pack)',
      'Markdown TPRM register export',
    ],
    priceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_STARTER_MONTHLY || '',
      annually: import.meta.env.VITE_STRIPE_PRICE_STARTER_ANNUAL || '',
    },
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'More vendors, more frameworks, more seats.',
    price: { monthly: 399, annually: 3990 },
    popular: true,
    features: [
      'Up to 150 vendors',
      '10 seats',
      'Multi-framework packs + bulk CSV',
      'Priority email support',
      'AI review assists (soft usage cap)',
    ],
    priceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_GROWTH_MONTHLY || '',
      annually: import.meta.env.VITE_STRIPE_PRICE_GROWTH_ANNUAL || '',
    },
  },
  {
    id: 'gov',
    name: 'Gov',
    description: 'Higher volume, SSO/SAML, dedicated staging, BAA/DPA process.',
    price: { monthly: 'Custom', annually: 'Custom' },
    features: [
      'Higher/unlimited vendors',
      'SSO / SAML',
      'Dedicated staging environment',
      'BAA / DPA process',
      'Negotiated add-on modules',
    ],
    priceId: {
      monthly: 'contact_sales',
      annually: 'contact_sales',
    },
  },
];

export function Pricing() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasActiveSubscription = profile?.subscriptionStatus === 'active';
  const stripeConfigured = Boolean(
    import.meta.env.VITE_STRIPE_PRICE_STARTER_MONTHLY &&
      import.meta.env.VITE_STRIPE_PRICE_STARTER_ANNUAL &&
      import.meta.env.VITE_STRIPE_PRICE_GROWTH_MONTHLY &&
      import.meta.env.VITE_STRIPE_PRICE_GROWTH_ANNUAL
  );

  const handleSubscribe = async (priceId: string) => {
    if (priceId === 'contact_sales') {
      window.location.href = SUPPORT_MAILTO;
      return;
    }
    if (!priceId) {
      setError('Self-serve checkout is not configured yet. Contact sales to subscribe.');
      return;
    }

    setError(null);
    setLoadingPlan(priceId);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ priceId, userId: user?.uid, email: user?.email }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout.');
      }
      window.location.href = data.url;
    } catch (ex: any) {
      setError(ex?.message || 'Could not start checkout.');
      setLoadingPlan(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-6xl mx-auto relative h-full"
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 right-6 z-50 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 max-w-sm"
          >
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-white font-display">{t('pricing.title')}</h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          {t('pricing.subtitle')}
        </p>
        {!stripeConfigured && (
          <p className="mx-auto max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
            Stripe price IDs are not set in this environment. Starter and Growth checkout stay
            disabled until <code className="font-mono">VITE_STRIPE_PRICE_*</code> is configured.
            Gov contact sales still works.
          </p>
        )}

        <div className="flex items-center justify-center gap-3 mt-8">
          <span className={`text-sm ${!isAnnual ? 'text-white' : 'text-slate-400'}`}>{t('pricing.monthly')}</span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary/20 border border-primary/50 transition-colors focus:outline-none"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-primary transition-transform ${isAnnual ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm ${isAnnual ? 'text-white' : 'text-slate-400'}`}>{t('pricing.annually')}</span>
          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
            Save 20%
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mt-12">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {plan.popular && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
                <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                  <Sparkles className="h-3 w-3" /> Most Popular
                </span>
              </div>
            )}
            <Card className={`h-full flex flex-col relative overflow-hidden ${plan.popular ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)] bg-indigo-950/20' : ''}`}>
              {plan.popular && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              )}
              <CardHeader>
                <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                <CardDescription className="h-10">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">
                    {typeof plan.price.monthly === 'number' ? '$' : ''}
                    {isAnnual ? plan.price.annually : plan.price.monthly}
                  </span>
                  {typeof plan.price.monthly === 'number' && (
                    <span className="text-slate-400 ml-2">/{isAnnual ? 'year' : 'month'}</span>
                  )}
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {(() => {
                  const priceId = isAnnual ? plan.priceId.annually : plan.priceId.monthly;
                  const checkoutDisabled =
                    plan.id !== 'gov' &&
                    (!stripeConfigured || !priceId || hasActiveSubscription);
                  return (
                    <Button
                      className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'} ${checkoutDisabled && plan.id !== 'gov' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => handleSubscribe(priceId)}
                      disabled={
                        loadingPlan === priceId ||
                        hasActiveSubscription ||
                        (plan.id !== 'gov' && (!stripeConfigured || !priceId))
                      }
                    >
                      {loadingPlan === priceId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : hasActiveSubscription ? (
                        t('pricing.current_plan')
                      ) : plan.id === 'gov' ? (
                        'Contact Sales'
                      ) : !stripeConfigured || !priceId ? (
                        'Checkout unavailable'
                      ) : (
                        t('pricing.subscribe')
                      )}
                    </Button>
                  );
                })()}
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
