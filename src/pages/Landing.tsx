import React, { useEffect } from 'react';
import { Shield, Zap, Globe, ArrowRight, CheckCircle2, Scale } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/brand';
import { hasPersistedFirebaseSession, resolveSignedInRedirect } from '../lib/sessionRedirect';
import { PUBLIC_PACK_DOMAIN_LABELS, SAFE_PACK_BASELINE } from '../lib/vendor/safePackWording';

export function Landing() {
  const navigate = useNavigate();

  // After first paint: only hydrate Firebase if a persisted session hint exists.
  useEffect(() => {
    if (!hasPersistedFirebaseSession()) return;

    let cancelled = false;
    const run = () => {
      void resolveSignedInRedirect().then((to) => {
        if (!cancelled && to) navigate(to, { replace: true });
      });
    };

    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(run, { timeout: 2500 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }

    const t = window.setTimeout(run, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden selection:bg-indigo-500/30">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.4)_2px,rgba(255,255,255,0.4)_3px)]" />
      </div>

      <header className="relative z-50 container mx-auto px-6 py-8 flex justify-between items-center bg-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
            <Shield className="h-6 w-6 text-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
          </div>
          <span className="text-2xl font-bold font-display tracking-tight">Guardentra</span>
        </div>
        <nav className="hidden lg:flex items-center gap-10 text-sm font-semibold text-slate-400">
          <a href="#features" className="hover:text-white transition-all hover:tracking-widest">
            Platform
          </a>
          <a href="#solutions" className="hover:text-white transition-all hover:tracking-widest">
            Insurance Core
          </a>
          <a href="#security" className="hover:text-white transition-all hover:tracking-widest">
            Audits
          </a>
        </nav>
        <div className="flex items-center gap-4">
          <Link to="/login">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/5 font-semibold">
              Sign In
            </Button>
          </Link>
          <Link to="/login">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 h-12 border-glow rounded-xl font-bold shadow-lg shadow-indigo-600/20">
              Request Demo
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 pt-24 pb-32">
        <section className="container mx-auto px-6 text-center">
          <div className="animate-landing-fade">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-10 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
              <Zap className="h-3.5 w-3.5 fill-current animate-pulse" />
              The Sovereign GRC Layer for Insurance
            </div>
            <h1 className="text-7xl md:text-[7rem] font-bold font-display tracking-tighter mb-8 leading-[0.85] text-white">
              Risk <span className="text-slate-500">is the business.</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-indigo-300 animate-gradient-x">
                Control it with AI.
              </span>
            </h1>
            <p className="max-w-4xl mx-auto text-lg md:text-xl text-slate-300 mb-14 leading-relaxed font-light">
              Guardentra is a third-party risk platform helping organizations assess vendors,
              identify questionnaire gaps, and strengthen supply-chain resilience. {SAFE_PACK_BASELINE}
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
              <Link to="/login">
                <Button className="h-20 px-12 text-xl bg-indigo-600 text-white hover:bg-indigo-500 rounded-3xl font-bold border-glow shadow-2xl shadow-indigo-600/30 group">
                  Deploy Instance
                  <ArrowRight className="h-6 w-6 ml-3 group-hover:translate-x-2 transition-transform" />
                </Button>
              </Link>
              <div className="flex items-center gap-4 text-slate-500 text-sm font-medium">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800" />
                  ))}
                </div>
                Trusted by 40+ Risk Heads
              </div>
            </div>
          </div>

          <div
            id="security"
            className="mt-28 py-10 border-y border-white/5 bg-white/[0.01] animate-landing-fade-delay"
          >
            <p className="text-[10px] uppercase font-bold tracking-[0.4em] text-slate-600 mb-4">
              Assessment pack domains
            </p>
            <p className="max-w-2xl mx-auto text-xs text-slate-500 mb-8">{SAFE_PACK_BASELINE}</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
              {PUBLIC_PACK_DOMAIN_LABELS.map((label) => (
                <div key={label} className="font-display font-black text-2xl tracking-tighter uppercase">
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-32 relative max-w-6xl mx-auto">
            <div className="absolute inset-0 bg-indigo-500/20 blur-[150px] pointer-events-none rounded-full scale-75" />
            <div className="glass-panel border-white/10 rounded-[3rem] p-6 pb-0 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 mb-6 px-4">
                <div className="w-3 h-3 rounded-full bg-rose-500/50" />
                <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                <div className="ml-4 h-6 w-full max-w-md bg-white/5 rounded-lg border border-white/5" />
              </div>
              <img
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=60&w=1200"
                alt="Guardentra Dashboard"
                width={1200}
                height={675}
                loading="lazy"
                decoding="async"
                className="rounded-t-[2.5rem] w-full opacity-90 border-t border-x border-white/10 shadow-2xl"
              />
            </div>
          </div>
        </section>

        <section id="solutions" className="container mx-auto px-6 py-40">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
              Built for the <span className="text-indigo-400">Sovereign Insurer</span>
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">
              Generic GRC tools fail in highly regulated environments. Guardentra was built from the ground up to handle
              insurance-specific complexities.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              {[
                {
                  t: 'Vendor assessment questionnaires',
                  d: `${SAFE_PACK_BASELINE} Questionnaires collect vendor answers; they do not certify compliance or map to unpublished regulatory catalogs.`,
                },
                {
                  t: 'Dynamic Third-Party Ledger',
                  d: 'Move beyond Excel. AI-driven vendor scoring that understands insurance data sensitivity.',
                },
                {
                  t: 'Continuous Board Readiness',
                  d: 'Live metrics and value-at-risk (VaR) reporting designed for BoD and Regulatory presentations.',
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-6 group">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">{item.t}</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="glass-panel p-10 rounded-[3rem] border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Scale className="h-48 w-48 text-indigo-400" />
              </div>
              <div className="relative z-10">
                <div className="text-indigo-400 font-mono text-xs mb-4">RELIANCE REPORT // Q2 2026</div>
                <h3 className="text-2xl font-bold mb-6">
                  &quot;Guardentra has transformed our audit cycle from a 6-month manual grind to a continuous,
                  board-ready dashboard.&quot;
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800" />
                  <div>
                    <div className="font-bold text-white uppercase tracking-wider text-xs">CISO, Global Tier-1 Carrier</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1 underline decoration-indigo-500/50">
                      VERIFIED USER
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="container mx-auto px-6 pb-40">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Shield className="h-6 w-6 text-indigo-400" />,
                title: 'Critical Infrastructure Risk',
                desc: 'Identify and defend against physical, logical, and cryptographic threats targeting critical utility grids, aerospace partners, and sovereign networks.',
              },
              {
                icon: <Globe className="h-6 w-6 text-purple-400" />,
                title: 'Supply Chain Resilience',
                desc: 'Track deep sub-tier vendor dependencies in real-time. Detect single points of failure, microelectronics bottlenecks, and international export vulnerabilities.',
              },
              {
                icon: <Scale className="h-6 w-6 text-emerald-400" />,
                title: 'Operational vendor review',
                desc: 'Collect vendor answers about operational practices using GuardEntra-authored questionnaires. This is not a regulatory filing or enforcement product.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="glass-panel p-10 rounded-[2.5rem] border-white/5 hover:border-indigo-500/30 transition-all duration-700 group cursor-default"
              >
                <div className="p-4 bg-white/5 rounded-2xl w-fit mb-8 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-white/5 bg-white/[0.02] py-20">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
              <div>
                <div className="text-4xl font-bold mb-2">92%</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Audit Speedup</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">10k+</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Risks Mitigated</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">24/7</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Live Monitoring</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">100%</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Data Sovereignty</div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 py-32 text-center">
          <div className="glass-panel p-16 rounded-[3rem] border-indigo-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-transparent pointer-events-none" />
            <h2 className="text-4xl md:text-6xl font-bold mb-8 relative z-10">
              Stop checking boxes. <br />
              Start managing risk.
            </h2>
            <p className="text-slate-400 mb-12 max-w-xl mx-auto relative z-10 tracking-wide">
              Join 200+ insurance carriers and MGAs who have moved their compliance program into the future.
            </p>
            <Link to="/login" className="relative z-10">
              <Button className="h-16 px-12 text-lg bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold border-glow">
                Create Your Free Instance
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-12">
        <div className="container mx-auto px-6 text-center text-slate-600 text-sm space-y-2">
          <p>© 2026 Guardentra Assurance Technologies. All Rights Reserved.</p>
          <p>
            Support:{' '}
            <a href={SUPPORT_MAILTO} className="text-slate-500 underline-offset-2 hover:text-slate-400 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
