import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/src/components/ui/card';
import { useAuth } from '../lib/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small teams getting started with GRC.',
    price: { monthly: 99, annually: 990 },
    features: [
      'Up to 5 users',
      'Basic Risk Management',
      'Standard Compliance Frameworks',
      'Email Support'
    ],
    priceId: {
      monthly: 'price_starter_monthly',
      annually: 'price_starter_annually'
    }
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Advanced features for growing organizations.',
    price: { monthly: 299, annually: 2990 },
    popular: true,
    features: [
      'Up to 25 users',
      'Advanced Risk Analytics',
      'Custom Compliance Frameworks',
      'AI-Powered Insights',
      'Priority Support'
    ],
    priceId: {
      monthly: 'price_pro_monthly',
      annually: 'price_pro_annually'
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full-scale GRC solution for large enterprises.',
    price: { monthly: 'Custom', annually: 'Custom' },
    features: [
      'Unlimited users',
      'Dedicated Account Manager',
      'On-premise deployment options',
      'Custom AI Model Training',
      '24/7 Phone Support'
    ],
    priceId: {
      monthly: 'contact_sales',
      annually: 'contact_sales'
    }
  }
];

export function Pricing() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const hasActiveSubscription = profile?.subscriptionStatus === 'active';

  const handleSubscribe = async (priceId: string) => {
    if (priceId === 'contact_sales') {
      window.location.href = 'mailto:sales@nexusgrc.com';
      return;
    }

    setLoadingPlan(priceId);
    try {
      if (profile && profile.organizationId) {
        const userRef = doc(db, 'users', user!.uid);
        await updateDoc(userRef, {
          subscriptionStatus: 'active',
          planId: priceId,
          updatedAt: new Date().toISOString()
        });
        
        await new Promise(r => setTimeout(r, 1000));
        setToastMessage(`SUCCESS: Plan upgraded to ${priceId?.toUpperCase()} successfully!`);
        setTimeout(() => {
          window.location.reload();
        }, 2200);
      }
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
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
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 right-6 z-50 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-white font-display">{t('pricing.title')}</h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          {t('pricing.subtitle')}
        </p>
        
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
                <Button 
                  className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'} ${hasActiveSubscription ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => handleSubscribe(isAnnual ? plan.priceId.annually : plan.priceId.monthly)}
                  disabled={loadingPlan === (isAnnual ? plan.priceId.annually : plan.priceId.monthly) || hasActiveSubscription}
                >
                  {loadingPlan === (isAnnual ? plan.priceId.annually : plan.priceId.monthly) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : hasActiveSubscription ? (
                    t('pricing.current_plan')
                  ) : plan.id === 'enterprise' ? (
                    'Contact Sales'
                  ) : (
                    t('pricing.subscribe')
                  )}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
