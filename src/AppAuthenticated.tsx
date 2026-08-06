import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ComingLater } from './pages/ComingLater';
import { RouteErrorBoundary } from './components/spine/RouteErrorBoundary';
import { isFeatureEnabled, type FeatureKey } from './lib/featureFlags';
import { isLocallyOnboarded } from './lib/onboardingFlag';
// Spine pages: eager so Vendor → Assess / Impact / triage never white-screens
// on a stale lazy chunk after deploy.
import { VendorsDirectory } from './pages/VendorsDirectory';
import { FastTrackTriage } from './pages/FastTrackTriage';
import { AssessmentWizard } from './pages/AssessmentWizard';
import { ImpactAssessment } from './pages/ImpactAssessment';
import { Assessments } from './pages/Assessments';

const Layout = lazy(() => import('./components/Layout').then((m) => ({ default: m.Layout })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const RiskManagement = lazy(() => import('./pages/RiskManagement').then((m) => ({ default: m.RiskManagement })));
const Compliance = lazy(() => import('./pages/Compliance').then((m) => ({ default: m.Compliance })));
const Incidents = lazy(() => import('./pages/Incidents').then((m) => ({ default: m.Incidents })));
const Connectors = lazy(() => import('./pages/Connectors').then((m) => ({ default: m.Connectors })));
const Policies = lazy(() => import('./pages/Policies').then((m) => ({ default: m.Policies })));
const VendorRisk = lazy(() => import('./pages/VendorRisk').then((m) => ({ default: m.VendorRisk })));
const VendorPortal = lazy(() => import('./pages/VendorPortal').then((m) => ({ default: m.VendorPortal })));
const AuditReadiness = lazy(() => import('./pages/AuditReadiness').then((m) => ({ default: m.AuditReadiness })));
const SystemHealth = lazy(() => import('./pages/SystemHealth').then((m) => ({ default: m.SystemHealth })));
const ExecutiveReports = lazy(() => import('./pages/ExecutiveReports').then((m) => ({ default: m.ExecutiveReports })));
const PolicyDraftsman = lazy(() => import('./pages/PolicyDraftsman').then((m) => ({ default: m.PolicyDraftsman })));
const AuditCalendar = lazy(() => import('./pages/AuditCalendar').then((m) => ({ default: m.AuditCalendar })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Pricing = lazy(() => import('./pages/Pricing').then((m) => ({ default: m.Pricing })));
const Documentation = lazy(() => import('./pages/Documentation').then((m) => ({ default: m.Documentation })));
const LiveAssistant = lazy(() => import('./pages/LiveAssistant').then((m) => ({ default: m.LiveAssistant })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const IdentityAccess = lazy(() => import('./pages/Devices').then((m) => ({ default: m.IdentityAccess })));
const TrustVault = lazy(() => import('./pages/TrustVault').then((m) => ({ default: m.TrustVault })));
const ContractNegotiator = lazy(() =>
  import('./pages/ContractNegotiator').then((m) => ({ default: m.ContractNegotiator }))
);
const GovIntelSuite = lazy(() => import('./pages/GovIntelSuite').then((m) => ({ default: m.GovIntelSuite })));
const TrustIntelligence = lazy(() =>
  import('./pages/TrustIntelligence').then((m) => ({ default: m.TrustIntelligence }))
);
const GmailAudit = lazy(() => import('./pages/GmailAudit').then((m) => ({ default: m.GmailAudit })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div
        className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}

function FeatureGate({ flag, children }: { flag: FeatureKey; children: React.ReactNode }) {
  return <>{isFeatureEnabled(flag) ? children : <ComingLater />}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading || (user && !profile && !isLocallyOnboarded(user.uid))) {
    return <RouteFallback />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  const needsOnboarding =
    !profile?.onboarded &&
    !isLocallyOnboarded(user.uid) &&
    window.location.pathname !== '/onboarding' &&
    window.location.pathname !== '/login';

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function ClearChunkReloadFlag() {
  useEffect(() => {
    try {
      sessionStorage.removeItem('guardentra_chunk_reload');
    } catch {
      /* private mode */
    }
  }, []);
  return null;
}

/** Authenticated (and login/portal) shell — Firebase loads only when this chunk loads. */
export default function AppAuthenticated() {
  return (
    <AuthProvider>
      <ClearChunkReloadFlag />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/portal/:assessmentId" element={<VendorPortal />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <RouteErrorBoundary label="This view">
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route path="/dashboard" element={<FeatureGate flag="dashboard"><Dashboard /></FeatureGate>} />
                      <Route path="/gov-intel" element={<FeatureGate flag="govIntel"><GovIntelSuite /></FeatureGate>} />
                      <Route
                        path="/trust-intelligence"
                        element={
                          <FeatureGate flag="trustIntelligence">
                            <TrustIntelligence />
                          </FeatureGate>
                        }
                      />
                      <Route path="/risks" element={<FeatureGate flag="risks"><RiskManagement /></FeatureGate>} />
                      <Route path="/compliance" element={<FeatureGate flag="compliance"><Compliance /></FeatureGate>} />
                      <Route path="/incidents" element={<FeatureGate flag="incidents"><Incidents /></FeatureGate>} />
                      <Route
                        path="/devices"
                        element={
                          <FeatureGate flag="identitySurface">
                            <IdentityAccess />
                          </FeatureGate>
                        }
                      />
                      <Route path="/trust-vault" element={<FeatureGate flag="trustVault"><TrustVault /></FeatureGate>} />
                      <Route
                        path="/contract-negotiator"
                        element={
                          <FeatureGate flag="contractAudit">
                            <ContractNegotiator />
                          </FeatureGate>
                        }
                      />
                      <Route path="/connectors" element={<FeatureGate flag="connectors"><Connectors /></FeatureGate>} />
                      <Route path="/gmail-audit" element={<FeatureGate flag="gmailAudit"><GmailAudit /></FeatureGate>} />
                      <Route path="/policies" element={<FeatureGate flag="policies"><Policies /></FeatureGate>} />
                      <Route
                        path="/policies/draftsman"
                        element={
                          <FeatureGate flag="policies">
                            <PolicyDraftsman />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="/vendors"
                        element={
                          <FeatureGate flag="vendorSpine">
                            <VendorsDirectory />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="/vendors/legacy"
                        element={
                          <FeatureGate flag="vendorsLegacy">
                            <VendorRisk />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="/vendors/:vendorId/impact"
                        element={
                          <FeatureGate flag="vendorSpine">
                            <ImpactAssessment />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="/assessments"
                        element={
                          <FeatureGate flag="assessments">
                            <Assessments />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="/assessments/triage"
                        element={
                          <FeatureGate flag="assessments">
                            <FastTrackTriage />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="/assessments/new"
                        element={
                          <FeatureGate flag="assessments">
                            <AssessmentWizard />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="/audit-readiness"
                        element={
                          <FeatureGate flag="auditReadiness">
                            <AuditReadiness />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="/calendar"
                        element={
                          <FeatureGate flag="auditCalendar">
                            <AuditCalendar />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="/executive-reports"
                        element={
                          <FeatureGate flag="executiveReports">
                            <ExecutiveReports />
                          </FeatureGate>
                        }
                      />
                      <Route path="/health" element={<FeatureGate flag="healthLab"><SystemHealth /></FeatureGate>} />
                      <Route path="/settings" element={<FeatureGate flag="settings"><Settings /></FeatureGate>} />
                      <Route path="/pricing" element={<FeatureGate flag="pricing"><Pricing /></FeatureGate>} />
                      <Route path="/docs" element={<FeatureGate flag="docs"><Documentation /></FeatureGate>} />
                      <Route
                        path="/ai-assistant"
                        element={
                          <FeatureGate flag="voiceStudio">
                            <LiveAssistant />
                          </FeatureGate>
                        }
                      />
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                  </RouteErrorBoundary>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
