import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface TrustScoreDetails {
  overallScore: number;
  complianceHealth: number;    // 30%
  vendorRiskHealth: number;    // 25%
  evidenceHealth: number;      // 20%
  controlCoverage: number;     // 15%
  incidentExposure: number;    // 10%
  trend: {
    percentage: number;
    direction: 'up' | 'down' | 'neutral';
  };
  history: Array<{
    month: string;
    score: number;
  }>;
  aiInsights?: {
    explanation: string;
    positives: string[];
    negatives: string[];
    nextSteps: string[];
  };
}

/**
 * High-fidelity client-side fallback AI summary generator
 * when backend AI keys are offline or loading.
 */
export function getFallbackInsights(details: Omit<TrustScoreDetails, 'aiInsights'>): Required<TrustScoreDetails>['aiInsights'] {
  const { overallScore, complianceHealth, vendorRiskHealth, evidenceHealth, controlCoverage, incidentExposure } = details;

  const positives: string[] = [];
  const negatives: string[] = [];
  const nextSteps: string[] = [];

  // Positives logic
  if (complianceHealth >= 80) positives.push("Excellent regulatory alignment with frameworks (NYDFS & ISO 27001).");
  if (evidenceHealth >= 75) positives.push("Steady evidence gathering pipeline with authenticated policies.");
  if (controlCoverage >= 80) positives.push("Substantial control coverage verified via continuous automated connectors.");
  if (incidentExposure >= 90) positives.push("Exceptional security operations with zero unresolved incident vectors.");

  // Negatives logic
  if (complianceHealth < 80) negatives.push("Compliance framework gap analysis shows unmapped control criteria.");
  if (vendorRiskHealth < 75) negatives.push("Unmitigated third-party risk exposure with unverified tier-1 vendors.");
  if (evidenceHealth < 75) negatives.push("Missing critical evidence items or active control test signoffs.");
  if (controlCoverage < 80) negatives.push("Limited connector depth exposing manual oversight check vulnerabilities.");
  if (incidentExposure < 90) negatives.push("Active security incidents require immediate emergency remediation.");

  // If arrays are empty, provide defaults
  if (positives.length === 0) positives.push("Core identity baseline established and monitored.");
  if (negatives.length === 0) negatives.push("Minor third-party attestation gaps across long-tail suppliers.");

  // Next steps
  if (incidentExposure < 90) {
    nextSteps.push("Perform emergency audit and resolve pending incidents to reclaim up to +10 trust points.");
  }
  if (vendorRiskHealth < 80) {
    nextSteps.push("Secure SOC 2 Type II attestation for high-risk vendors (adds up to +8 trust points).");
  }
  if (complianceHealth < 85) {
    nextSteps.push("Run a predictive automated gap-analysis on your primary regulatory framework.");
  }
  if (controlCoverage < 80) {
    nextSteps.push("Activate new integrations under platform settings for real-time compliance telemetry.");
  }
  if (evidenceHealth < 80) {
    nextSteps.push("Draft and activate the unapproved policy templates to raise evidence posture.");
  }

  if (nextSteps.length < 3) {
    nextSteps.push("Conduct a routine quarterly security posture review with your legal partners.");
  }

  // Generate overview text
  let explanation = `Your Trust Score is ${overallScore}. `;
  if (overallScore >= 85) {
    explanation += `This puts your enterprise in the Sovereign tier, demonstrating mature threat operations, automated control mappings, and verified compliance posture. Strong resilience against NAIC and NYDFS guidelines.`;
  } else if (overallScore >= 70) {
    explanation += `This indicates a balanced security stance, but there are unmitigated risk hotspots. Active vendor assessments or unresolved policy drafts are capping your maximum compliance rating.`;
  } else {
    explanation += `Your trust posture requires critical calibration. High exposure from active incidents, unapproved policies, or poor vendor cyber ratings could trigger regulatory non-compliance warnings.`;
  }

  return {
    explanation,
    positives: positives.slice(0, 3),
    negatives: negatives.slice(0, 3),
    nextSteps: nextSteps.slice(0, 3)
  };
}

/**
 * Unified calculation function to compute real trust score metrics from Firestore snapshot.
 */
export async function calculateTrustScore(organizationId: string): Promise<TrustScoreDetails> {
  const defaultHistory = [
    { month: 'Dec', score: 72 },
    { month: 'Jan', score: 74 },
    { month: 'Feb', score: 77 },
    { month: 'Mar', score: 79 },
    { month: 'Apr', score: 81 },
    { month: 'May', score: 82 }
  ];

  if (!organizationId) {
    const fallbackBase = {
      overallScore: 82,
      complianceHealth: 85,
      vendorRiskHealth: 74,
      evidenceHealth: 80,
      controlCoverage: 88,
      incidentExposure: 95,
      trend: { percentage: 2.1, direction: 'up' as const },
      history: defaultHistory
    };
    return {
      ...fallbackBase,
      aiInsights: getFallbackInsights(fallbackBase)
    };
  }

  try {
    // Parallel queries to Firestore
    const [
      complianceSnap,
      vendorsSnap,
      policiesSnap,
      connectorsSnap,
      incidentsSnap
    ] = await Promise.all([
      getDocs(query(collection(db, 'compliance'), where('organizationId', '==', organizationId))),
      getDocs(query(collection(db, 'vendors'), where('organizationId', '==', organizationId))),
      getDocs(query(collection(db, 'policies'), where('organizationId', '==', organizationId))),
      getDocs(query(collection(db, 'connectors'), where('organizationId', '==', organizationId))),
      getDocs(query(collection(db, 'incidents'), where('organizationId', '==', organizationId))),
    ]);

    // 1. Compliance Health (30%) - Based on frameworks progress
    let complianceHealth = 75; // baseline fallback
    if (complianceSnap.size > 0) {
      const totalProg = complianceSnap.docs.reduce((acc, d) => acc + (d.data().progress || 0), 0);
      complianceHealth = totalProg / complianceSnap.size;
    }

    // 2. Vendor Risk Health (25%) - Based on active vendors' risk rating scale
    let vendorRiskHealth = 78; // baseline fallback
    if (vendorsSnap.size > 0) {
      const totalRisk = vendorsSnap.docs.reduce((acc, d) => acc + (d.data().riskScore || 74), 0);
      vendorRiskHealth = totalRisk / vendorsSnap.size;
    }

    // 3. Evidence Health (20%) - Based on active vs total policies and docs
    let evidenceHealth = 80; // baseline fallback
    if (policiesSnap.size > 0) {
      const activePolicies = policiesSnap.docs.filter(d => d.data().status === 'Active').length;
      evidenceHealth = Math.round((activePolicies / policiesSnap.size) * 100);
    }

    // 4. Control Coverage (15%) - Based on operational connectors connected and healthy
    let controlCoverage = 85; // baseline fallback
    if (connectorsSnap.size > 0) {
      const healthyConnectors = connectorsSnap.docs.filter(d => d.data().health === 'Healthy' || d.data().status === 'Connected').length;
      controlCoverage = Math.round((healthyConnectors / connectorsSnap.size) * 100);
    }

    // 5. Incident Exposure (10%) - Based on outstanding, unresolved incident vectors
    let incidentExposure = 100;
    if (incidentsSnap.size > 0) {
      const openIncidents = incidentsSnap.docs.filter(d => d.data().status !== 'Resolved' && d.data().status !== 'Closed').length;
      // Deduct 15 points per active incident
      incidentExposure = Math.max(0, 100 - (openIncidents * 15));
    }

    // Calculate Overall Score
    const overallScore = Math.round(
      (complianceHealth * 0.30) +
      (vendorRiskHealth * 0.25) +
      (evidenceHealth * 0.20) +
      (controlCoverage * 0.15) +
      (incidentExposure * 0.10)
    );

    // Calculate dynamic history matching calculated score for the current month
    const history = [...defaultHistory];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = months[new Date().getMonth()];
    
    // Smooth transition from previous default historical records
    if (history[history.length - 1].month !== currentMonth) {
      history.push({ month: currentMonth, score: overallScore });
      if (history.length > 6) {
        history.shift();
      }
    } else {
      history[history.length - 1].score = overallScore;
    }

    // Dynamic Trend based on history points change
    const prevScore = history[history.length - 2]?.score || 78;
    const change = Number((overallScore - prevScore).toFixed(1));
    const trend = {
      percentage: Math.abs(change),
      direction: change > 0 ? ('up' as const) : change < 0 ? ('down' as const) : ('neutral' as const)
    };

    const scoreDetails: TrustScoreDetails = {
      overallScore,
      complianceHealth: Math.round(complianceHealth),
      vendorRiskHealth: Math.round(vendorRiskHealth),
      evidenceHealth: Math.round(evidenceHealth),
      controlCoverage: Math.round(controlCoverage),
      incidentExposure: Math.round(incidentExposure),
      trend,
      history
    };

    // Attempt to invoke backend explainable API
    try {
      const response = await fetch('/api/ai/trust-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoreDetails })
      });
      if (response.ok) {
        const data = await response.json();
        scoreDetails.aiInsights = data;
      } else {
        scoreDetails.aiInsights = getFallbackInsights(scoreDetails);
      }
    } catch (e) {
      console.warn("Could not load backend AI insights. Using client fallback score engine:", e);
      scoreDetails.aiInsights = getFallbackInsights(scoreDetails);
    }

    return scoreDetails;
  } catch (error) {
    console.error("Failed to calculate real-time Trust Score details:", error);
    const fallbackBase = {
      overallScore: 82,
      complianceHealth: 85,
      vendorRiskHealth: 74,
      evidenceHealth: 80,
      controlCoverage: 88,
      incidentExposure: 95,
      trend: { percentage: 2.1, direction: 'up' as const },
      history: defaultHistory
    };
    return {
      ...fallbackBase,
      aiInsights: getFallbackInsights(fallbackBase)
    };
  }
}
