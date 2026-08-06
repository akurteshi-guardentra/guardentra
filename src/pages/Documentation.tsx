import React from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  FileCheck,
  BookOpen,
  CreditCard,
  Settings,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const LIVE = [
  {
    name: 'Vendors',
    path: '/vendors',
    icon: Building2,
    desc: 'Register third parties, set business impact, and track assessment status.',
  },
  {
    name: 'Assessments',
    path: '/assessments',
    icon: ClipboardList,
    desc: 'Build framework questionnaires, share the vendor portal link, and review answers.',
  },
  {
    name: 'Audit Lab',
    path: '/audit-readiness',
    icon: FileCheck,
    desc: 'Framework readiness scores and evidence gaps for your organization.',
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: Settings,
    desc: 'Team invites and framework pack version defaults.',
  },
  {
    name: 'Pricing',
    path: '/pricing',
    icon: CreditCard,
    desc: 'Starter, Growth, and Gov plans for the vendor TPRM spine.',
  },
];

export function Documentation() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
            <BookOpen className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight font-display">
          Product guide
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Guardentra&apos;s live product is the vendor TPRM spine: vendors → assessments → portal →
          Audit Lab. Frozen modules (Risks, Policies, Trust Vault, etc.) stay behind Coming later.
        </p>
        <Link
          to="/vendors"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
        >
          Open vendors
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LIVE.map((item) => (
          <Card key={item.path} className="border-white/10 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <item.icon className="h-5 w-5 text-primary" />
                {item.name}
              </CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to={item.path}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Go to {item.name} →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/10 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Shield className="h-5 w-5 text-primary" />
            Vendor portal loop
          </CardTitle>
          <CardDescription>
            Create a vendor with a contact email → New Assessment → copy the portal URL → open it in
            an incognito window (keeps your org session intact) → vendor answers → Review on
            Assessments.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link to="/assessments/new" className="text-sm text-primary hover:underline">
            Start assessment wizard →
          </Link>
          <span className="text-slate-600">·</span>
          <Link to="/pricing" className="text-sm text-primary hover:underline">
            View pricing →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
