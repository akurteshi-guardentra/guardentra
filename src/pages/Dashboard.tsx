import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { Building2, ClipboardList, FileCheck, Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { SetupChecklist } from '../components/SetupChecklist';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import {
  deriveSetupChecklist,
  isSetupChecklistComplete,
  type OrgSetupSnapshot,
} from '../lib/setupProgress';

type DashStats = {
  vendorCount: number;
  pendingAssessments: number;
  completedAssessments: number;
  assessmentCount: number;
  readinessScore: number | null;
  pendingTeammateInviteCount: number;
  org: OrgSetupSnapshot | null;
};

export function Dashboard() {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();
  const [stats, setStats] = useState<DashStats>({
    vendorCount: 0,
    pendingAssessments: 0,
    completedAssessments: 0,
    assessmentCount: 0,
    readinessScore: null,
    pendingTeammateInviteCount: 0,
    org: null,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!profile?.organizationId) {
      setLoadingStats(false);
      return;
    }

    const orgId = profile.organizationId;
    let cancelled = false;

    (async () => {
      try {
        const [vendorsSnap, assessSnap, auditSnap, invitesSnap, orgSnap] = await Promise.all([
          getDocs(query(collection(db, 'vendors'), where('organizationId', '==', orgId), limit(500))),
          getDocs(query(collection(db, 'assessments'), where('organizationId', '==', orgId), limit(500))),
          getDocs(query(collection(db, 'audit_readiness'), where('organizationId', '==', orgId), limit(5))),
          getDocs(
            query(
              collection(db, 'org_invites'),
              where('organizationId', '==', orgId),
              where('status', '==', 'pending'),
              limit(50),
            ),
          ),
          getDoc(doc(db, 'organizations', orgId)),
        ]);

        const pending = assessSnap.docs.filter((d) => d.data().status !== 'Completed').length;
        const completed = assessSnap.docs.filter((d) => d.data().status === 'Completed').length;
        let readiness: number | null = null;
        if (!auditSnap.empty) {
          const row = auditSnap.docs[0].data() as { readinessScore?: number; score?: number };
          readiness = Number(row.readinessScore ?? row.score ?? 0) || null;
        }

        const orgData = orgSnap.exists() ? (orgSnap.data() as OrgSetupSnapshot) : null;

        if (!cancelled) {
          setStats({
            vendorCount: vendorsSnap.size,
            pendingAssessments: pending,
            completedAssessments: completed,
            assessmentCount: assessSnap.size,
            readinessScore: readiness,
            pendingTeammateInviteCount: invitesSnap.size,
            org: orgData,
          });
        }
      } catch (err) {
        console.error('Dashboard: failed to load spine stats', err);
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.organizationId]);

  const checklist = useMemo(
    () =>
      deriveSetupChecklist({
        org: stats.org,
        vendorCount: stats.vendorCount,
        assessmentCount: stats.assessmentCount,
        pendingTeammateInviteCount: stats.pendingTeammateInviteCount,
        role: profile?.role,
      }),
    [stats, profile?.role],
  );

  const checklistComplete = isSetupChecklistComplete(checklist);

  if (loading || loadingStats) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const firstName = profile?.displayName?.split(' ')[0] || 'there';

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-slate-400">
            Vendor register, structured assessments, and Audit Lab — the Guardentra TPRM spine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => navigate('/vendors')}
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Building2 className="mr-2 h-4 w-4" />
            Vendors
          </Button>
          <Button
            onClick={() => navigate('/assessments/new')}
            className="bg-primary text-white hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Assessment
          </Button>
        </div>
      </div>

      <SetupChecklist items={checklist} hidden={checklistComplete} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer border-white/10 bg-slate-900/50 transition-colors hover:border-primary/40"
          onClick={() => navigate('/vendors')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Vendors
            </CardDescription>
            <CardTitle className="font-mono text-3xl text-white">{stats.vendorCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Registered third parties</CardContent>
        </Card>
        <Card
          className="cursor-pointer border-white/10 bg-slate-900/50 transition-colors hover:border-primary/40"
          onClick={() => navigate('/assessments')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Pending assessments
            </CardDescription>
            <CardTitle className="font-mono text-3xl text-white">{stats.pendingAssessments}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            {stats.completedAssessments} completed
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer border-white/10 bg-slate-900/50 transition-colors hover:border-primary/40"
          onClick={() => navigate('/audit-readiness')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Audit Lab
            </CardDescription>
            <CardTitle className="font-mono text-3xl text-white">
              {stats.readinessScore != null ? `${stats.readinessScore}%` : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Latest readiness score</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-white/10 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base text-white">Assessment tracker</CardTitle>
            <CardDescription>Open questionnaires and review vendor responses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => navigate('/assessments')}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Open assessments →
            </Button>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base text-white">Audit readiness</CardTitle>
            <CardDescription>Framework packs, evidence, and readiness scores.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => navigate('/audit-readiness')}
            >
              <FileCheck className="mr-2 h-4 w-4" />
              Open Audit Lab →
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
