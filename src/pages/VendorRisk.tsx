import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  Plus, 
  Search, 
  Users, 
  ShieldAlert, 
  FileSearch, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  ExternalLink, 
  MoreVertical, 
  Trash2, 
  Zap, 
  Loader2,
  Building2,
  FileText,
  ChevronRight,
  ShieldCheck,
  Globe,
  Newspaper,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Clock,
  Activity,
  CheckSquare,
  Wrench,
  Bell,
  History,
  Lock,
  Shield
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';

// AI Evidence Review Engine imports
import { EvidenceReviewService, EvidenceReviewResult, EvidenceReviewRecord } from '../services/EvidenceReviewService';
import { EvidenceSummaryCard } from '../components/EvidenceSummaryCard';
import { EvidenceFindingCard } from '../components/EvidenceFindingCard';
import { EvidenceGapCard } from '../components/EvidenceGapCard';
import { EvidenceRecommendationCard } from '../components/EvidenceRecommendationCard';
import { RemediationEngine } from '../components/RemediationEngine';

interface Vendor {
  id: string;
  name: string;
  category: string;
  criticality: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Pending' | 'Terminated';
  riskScore: number;
  reputation?: string;
  organizationId: string;
  createdAt: string;
  
  // Workspace specific extended fields from specifications
  riskTier?: 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4' | string;
  trustScore?: number;
  complianceStatus?: 'Compliant' | 'Partial' | 'Non-Compliant' | string;
  lastAssessment?: string;
  nextAssessment?: string;
  briefing?: string;
}

interface Assessment {
  id: string;
  vendorId: string;
  type: 'SOC2' | 'Questionnaire' | 'Self-Assessment';
  summary: string;
  findings: string[];
  score: number;
  createdAt: string;
}

// Interactive Sub-tabs dynamic helper structures
interface EvidenceItem {
  id: string;
  name: string;
  expirationDate: string;
  status: 'Verified' | 'Pending review' | 'Expired';
  aiSummary: string;
}

interface FindingItem {
  id: string;
  finding: string;
  recommendation: string;
  dueDate: string;
  owner: string;
  status: 'Open' | 'In Progress' | 'Remediated';
}

interface MonitoringAlert {
  id: string;
  type: 'Alert' | 'Expiration' | 'Trigger';
  title: string;
  description: string;
  date: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
}

interface AuditRecord {
  id: string;
  activity: string;
  date: string;
  by: string;
  status: string;
}

// High-fidelity profile drivers that derive risks and details adaptively based on each individual vendor signature
function getDynamicRiskProfile(vendor: Vendor) {
  const base = vendor.riskScore || 74;
  const modifier = vendor.criticality === 'Critical' ? 12 : vendor.criticality === 'High' ? 6 : -4;
  
  return {
    cyber: Math.max(12, Math.min(96, Math.round(98 - base + modifier))),
    compliance: Math.max(10, Math.min(92, Math.round(92 - base + (modifier / 2)))),
    operational: Math.max(15, Math.min(95, Math.round(100 - base + modifier))),
    environmental: Math.max(8, Math.min(88, Math.round(75 - (base / 2) + (vendor.criticality === 'Critical' ? 8 : 0)))),
  };
}

function getDynamicEvidenceList(vendor: Vendor): EvidenceItem[] {
  const score = vendor.riskScore || 74;
  const isHealthy = score > 80;
  return [
    {
      id: 'soc2',
      name: 'SOC 2 Type II Security & Confidentiality Attestation Report',
      expirationDate: '2027-04-15',
      status: 'Verified',
      aiSummary: `The latest SOC 2 Type II report for ${vendor.name} confirms automated firewall rules, logical separation of tenant data, and daily automated encrypted DB snapshots, with zero critical deviations identified.`
    },
    {
      id: 'mfa',
      name: 'IAM & MFA Enforcement & Session Attestation Log',
      expirationDate: isHealthy ? '2026-12-01' : 'Expired 3 months ago!',
      status: isHealthy ? 'Verified' : 'Expired',
      aiSummary: isHealthy 
        ? 'Audit verifies 100% SAML single-sign on coverage and mandatory push/WebAuthn configurations for all console endpoints.'
        : `MFA evidence expired. Security telemetry detected direct root console queries originating from administrative vendor subcontractors bypassing multifactor rules.`
    },
    {
      id: 'iso',
      name: 'ISO / IEC 27001 Information Security Management Certificate',
      expirationDate: '2026-10-10',
      status: 'Verified',
      aiSummary: 'ISO certification is current and covers primary storage infrastructure, operational facilities, and code release automated pipelines.'
    },
    {
      id: 'bcp',
      name: 'Regulatory Disaster Recovery and Business Continuity Plan (BCP)',
      expirationDate: '2026-11-20',
      status: 'Pending review',
      aiSummary: 'Outlines recovery time objectives (RTO) of <4 hours with multi-region database fallback. Awaiting visual confirmation of last failover drill.'
    }
  ];
}

function getDynamicFindingsList(vendor: Vendor): FindingItem[] {
  const score = vendor.riskScore || 74;
  const isHealthy = score > 80;
  if (isHealthy) {
    return [
      {
        id: 'find1',
        finding: 'Minor: Static data retention limits not fully policy-enforced',
        recommendation: 'Configure automated lifecycle policies to permanently sweep staging files older than 180 days.',
        dueDate: '2026-11-30',
        owner: 'SecOps Team',
        status: 'In Progress'
      }
    ];
  } else {
    return [
      {
        id: 'find-mfa',
        finding: 'Critical: Incomplete MFA enforcement on active administrative endpoints',
        recommendation: 'De-provision un-enforced subkey systems and require mandatory identity provider (IDP) dual-factor check ins for all routes.',
        dueDate: '2026-06-30',
        owner: 'Lead Cloud Architect',
        status: 'Open'
      },
      {
        id: 'find-sub',
        finding: 'High: Unverified offshore subcontractor queries of sensitive customer telemetry',
        recommendation: 'Isolate subnet access configurations and acquire bridging subcontractor compliance attestations.',
        dueDate: '2026-07-15',
        owner: 'Compliance Lead',
        status: 'Open'
      }
    ];
  }
}

function getDynamicMonitoringAlerts(vendor: Vendor): MonitoringAlert[] {
  const score = vendor.riskScore || 74;
  const isHealthy = score > 80;
  const alerts: MonitoringAlert[] = [
    {
      id: 'mon1',
      type: 'Trigger',
      title: 'Solvency II Compliance Score Drift Alert',
      description: 'Continuous monitoring pipeline detected minor deviation in service level agreement (SLA) response duration.',
      date: '3 days ago',
      severity: 'Medium'
    }
  ];
  if (!isHealthy) {
    alerts.unshift({
      id: 'mon-mfa',
      type: 'Alert',
      title: 'MFA Attestation Failure Triggered',
      description: 'Vendor failed to renew secondary MFA attestation logs. Platform Trust Score decremented by 15 points.',
      date: 'Yesterday',
      severity: 'Critical'
    });
    alerts.push({
      id: 'mon-cert',
      type: 'Expiration',
      title: 'Wildcard SSL Root Certificate Expiring',
      description: `The vendor's public-facing sandbox interface (*.sandbox.${vendor.name.toLowerCase().replace(/\s+/g, '')}.com) SSL certificate expires in 14 days.`,
      date: '5 days ago',
      severity: 'High'
    });
  } else {
    alerts.push({
      id: 'mon-info',
      type: 'Alert',
      title: 'Routine Health Ping Success',
      description: 'Active threat endpoints check-in compiled successfully. Zero dynamic regulatory outliers identified.',
      date: 'Today',
      severity: 'Low'
    });
  }
  return alerts;
}

function getDynamicAuditHistory(vendor: Vendor): AuditRecord[] {
  return [
    {
      id: 'aud1',
      activity: 'AI Risk scorecard recalibrated after continuous compliance scans',
      date: '2026-05-30',
      by: 'Guardentra AI Engine',
      status: 'Success'
    },
    {
      id: 'aud2',
      activity: 'ISO 27001 Evidence upload recognized and validated',
      date: '2026-05-24',
      by: 'Compliance Analyst (atdhee.kurteshi@gmail.com)',
      status: 'Completed'
    },
    {
      id: 'aud3',
      activity: 'Annual Corporate Cybersecurity Self-Assessment questionnaire compiled and scoring generated',
      date: '2026-03-15',
      by: 'Vendor Security Team',
      status: 'Verified'
    },
    {
      id: 'aud4',
      activity: 'Initial vendor onboarding and policy baseline definition',
      date: '2026-01-10',
      by: 'System Admin',
      status: 'Initial State'
    }
  ];
}

// Preset templates for Guardentra GRC Evidence Review Engine
const GRC_DOC_TEMPLATES: Record<string, { name: string; content: string }> = {
  'SOC 2 Reports': {
    name: 'SOC2_TypeII_Attestation_April_2026.txt',
    content: `SYSTEM DESCRIPTION AND SCOPE OF ASSESSMENT:
This report covers the trust services principles for Security, Confidentiality, and Availability of Acme Corp Cloud Operations from March 2025 to April 2026.

FIREWALLS AND ENDPOINT RESTRICTIONS:
Acme Corp implements host-level automated firewalls with daily ruleset synchronization. Physical network connections are locked. Logical access is restricted via enterprise single sign-on mechanisms.

EXCEPTIONS DETECTED:
1. Security telemetry detected that staging/development containers bypass corporate OIDC/SSO single-sign-on requirements, allowing single-factor local credential access to secondary administrative ports.
2. Credentials reuse has been noted on non-production test databases containing synthesized consumer mock databases.

EVIDENCE MATRIX MATCHING:
- Daily DB Backups: verified and encrypted with KMS keys (256-bit AES).
- Database configuration drift checklists: absent or not produced as a formal artifact.
- HR Deactivation logs: list 2 retired engineers who retained subkey query permissions for 14 working days after exit.`
  },
  'ISO Certificates': {
    name: 'ISO_IEC_27001_2022_Certification.txt',
    content: `INTERNATIONAL STANDARD COMPLIANCE STATEMENT:
This certifies that the Information Security Management System (ISMS) of Acme Labs Ltd has been audited and found to conform to the requirements of ISO/IEC 27001:2022.

SCOPE OF REGISTRATION:
All development nodes, regional bare-metal server configurations, and corporate systems situated across standard North American physical data centers.

FINDINGS AND OBSERVATIONS:
- Supplier relations (Control A.15): Multi-factor credentials for offshore subcontractor organizations have not been formally verified or checked in the vendor register.
- Continuous vulnerability checks: automated internal infrastructure scans run daily.
- External penetration exercises: while noted as scheduled annually, the physical penetration testing receipts and actual full external testing reports are omitted from external ISMS folder attachments.`
  },
  'Security Policies': {
    name: 'Corporate_Information_Security_Directive_v3.txt',
    content: `SECTION 1: PURPOSE AND OBJECTIVE:
To establish strict cybersecurity procedures regarding remote workstations, user permissions, password complexities, and external data storage.

SECTION 2: PASSWORD MANAGEMENT:
Passwords must adhere to standard complexity guidelines. However, SaaS interfaces bypass central directory sync controls under standard department-level setups.

SECTION 3: DATA JURISDICTIONS:
Security policy currently states that customer data will reside within global secure database nodes. It does not provide explicit constraints or definitions concerning offshore subcontractor data routing limits.

SECTION 4: VERIFICATION AND ENFORCEABILITY:
Violated terms trigger disciplinary procedures up to contractual termination.`
  },
  'Vendor Questionnaires': {
    name: 'Supplier_Risk_Assessment_Compliance_Survey.txt',
    content: `Self-Assessment Compliance Survey Responses - vendor: SaaS Enterprise Admin Inc.

QUESTION 3.2: HOW DO YOU PURGE EXPIRED CUSTOMER DATA?
Response: Data lifetimes are manually monitored and permanently purged by a database administrator twice per fiscal year, rather than relying on automated cloud-native backend purge scripts.

QUESTION 5.1: DESCRIBE DISASTER RECOVERY DRILLS.
Response: Physical disaster failovers and database restoration plans are verified with mock drills once per 18 months. The last record of real-world drill failover simulation was uploaded over 14 months ago.`
  },
  'Audit Reports': {
    name: 'Internal_Security_Audit_Report_Q1.txt',
    content: `GRC AUDIT STATEMENT - INTERNAL COMPLIANCE:
Internal assessment evaluated standard security levels across production database clusters.

AUDIT EXCEPTIONS:
1. Continuous monitoring checks: auditing pipelines have not been fully initialized on newly provisioned staging clusters.
2. Log times on SQL query audits were rotated and permanently cleaned up after 14 days, failing to meet the corporate 90-day retention constraint.
3. Root API credentials are log-tracked on central performance monitoring dashboards.`
  }
};

export function VendorRisk() {
  const { profile, loading } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assessments, setAssessments] = useState<Record<string, Assessment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState<'magic-adding' | 'excel-importing' | string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelPaste, setExcelPaste] = useState('');
  const [vendorFormError, setVendorFormError] = useState('');
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [vendorNews, setVendorNews] = useState<any[]>([]);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [workSpacesTabs, setWorkSpacesTabs] = useState<Record<string, 'overview' | 'risk' | 'evidence' | 'remediation' | 'monitoring' | 'audit_history'>>({});

  // AI Evidence Review Engine states
  const [activeReviews, setActiveReviews] = useState<Record<string, EvidenceReviewResult | null>>({});
  const [isReviewing, setIsReviewing] = useState<Record<string, boolean>>({});
  const [reviewError, setReviewError] = useState<Record<string, string>>({});
  const [reviewDocs, setReviewDocs] = useState<Record<string, { type: string; name: string; content: string }>>({});
  const [saveLoading, setSaveLoading] = useState<Record<string, boolean>>({});
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [historicReviews, setHistoricReviews] = useState<Record<string, EvidenceReviewRecord[]>>({});
  const [viewingHistoricReview, setViewingHistoricReview] = useState<Record<string, EvidenceReviewRecord | null>>({});
  const [isAddingFindingTicket, setIsAddingFindingTicket] = useState<Record<string, string | null>>({});
  const [remediationTicketsLogged, setRemediationTicketsLogged] = useState<Record<string, string[]>>({});

  const loadHistoricReviews = async (vendorId: string) => {
    try {
      const orgId = profile?.organizationId || '';
      const records = await EvidenceReviewService.getReviewsByVendor(vendorId, orgId);
      setHistoricReviews(prev => ({ ...prev, [vendorId]: records }));
    } catch (err) {
      console.error("Failed to load historic evidence reviews:", err);
    }
  };

  const handleAnalyzeEvidence = async (vendorId: string, vendorName: string) => {
    const docSelection = reviewDocs[vendorId];
    if (!docSelection || !docSelection.content.trim()) {
      setReviewError(prev => ({ ...prev, [vendorId]: "Please enter some document content or select a template to analyze." }));
      return;
    }
    
    setIsReviewing(prev => ({ ...prev, [vendorId]: true }));
    setReviewError(prev => ({ ...prev, [vendorId]: "" }));
    setViewingHistoricReview(prev => ({ ...prev, [vendorId]: null }));
    
    try {
      const result = await EvidenceReviewService.analyzeEvidence(
        docSelection.type,
        docSelection.name,
        docSelection.content,
        vendorName
      );
      
      setActiveReviews(prev => ({ ...prev, [vendorId]: result }));
      setSavedStatus(prev => ({ ...prev, [vendorId]: false }));
    } catch (err: any) {
      console.error(err);
      setReviewError(prev => ({ ...prev, [vendorId]: err.message || "Failed to analyze evidence via Guardentra AI." }));
    } finally {
      setIsReviewing(prev => ({ ...prev, [vendorId]: false }));
    }
  };

  const handleSaveReview = async (vendorId: string, docType: string, filename: string) => {
    const result = activeReviews[vendorId];
    if (!result) return;
    
    setSaveLoading(prev => ({ ...prev, [vendorId]: true }));
    try {
      const orgId = profile?.organizationId || '';
      await EvidenceReviewService.saveReview(vendorId, docType, filename, result, orgId);
      setSavedStatus(prev => ({ ...prev, [vendorId]: true }));
      // Reload history list
      await loadHistoricReviews(vendorId);
    } catch (err) {
      console.error("Failed to save review:", err);
    } finally {
      setSaveLoading(prev => ({ ...prev, [vendorId]: false }));
    }
  };

  const handleDeleteReview = async (vendorId: string, reviewId: string) => {
    try {
      await EvidenceReviewService.deleteReview(reviewId);
      if (viewingHistoricReview[vendorId]?.id === reviewId) {
        setViewingHistoricReview(prev => ({ ...prev, [vendorId]: null }));
      }
      await loadHistoricReviews(vendorId);
    } catch (err) {
      console.error("Failed to delete review:", err);
    }
  };

  const handleRemediateFinding = async (vendorId: string, finding: string, recommendation: string) => {
    setIsAddingFindingTicket(prev => ({ ...prev, [vendorId]: finding }));
    try {
      const targetVendor = vendors.find(v => v.id === vendorId);
      if (targetVendor) {
        const currentScore = targetVendor.riskScore || 74;
        const newScore = Math.min(100, currentScore + 2); // incremental improvement
        await updateDoc(doc(db, 'vendors', vendorId), {
          riskScore: newScore,
          trustScore: newScore,
          briefing: `Active remediation ticket filed. Pending compliance audit review on key exception: "${finding}".`
        });
      }
      
      setRemediationTicketsLogged(prev => ({
        ...prev,
        [vendorId]: [...(prev[vendorId] || []), finding]
      }));
    } catch (err) {
      console.error("Failed to file remediation ticket:", err);
    } finally {
      setIsAddingFindingTicket(prev => ({ ...prev, [vendorId]: null }));
    }
  };

  const refreshVendorIntelligence = async () => {
    if (vendors.length === 0) return;
    setIsRefreshingNews(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const vendorNames = vendors.slice(0, 5).map(v => v.name).join(', ');
      
      const prompt = `Act as a Cyber Threat Intelligence analyst. For these vendors: ${vendorNames}, provide 3 simulated recent security news items or "global alerts".
      The alerts should be business-critical. Include a "Recommended Action" that a NON-TECHNICAL manager can take.
      Return a JSON array: [{ vendor, date, severity: 'Critical'|'High'|'Medium', title, summary, action: "Simple step like 'Email their rep' or 'Check usage'" }]`;

      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(result.text || "[]");
      setVendorNews(data);
    } catch (e) {
      console.error("Failed to fetch vendor intelligence:", e);
    } finally {
      setIsRefreshingNews(false);
    }
  };

  useEffect(() => {
    if (vendors.length > 0 && vendorNews.length === 0) {
      refreshVendorIntelligence();
    }
  }, [vendors.length]);

  useEffect(() => {
    if (loading) return;

    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'vendors'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Vendor[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Vendor);
      });
      setVendors(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const fetchAssessments = (vendorId: string) => {
    if (assessments[vendorId]) return;

    const q = query(
      collection(db, 'vendor_assessments'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
      const data: Assessment[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Assessment);
      });
      setAssessments(prev => ({ ...prev, [vendorId]: data }));
    });
  };

  useEffect(() => {
    if (expandedVendor) {
      fetchAssessments(expandedVendor);
      loadHistoricReviews(expandedVendor);
    }
  }, [expandedVendor]);

  const handleMagicAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const vendorName = formData.get('magicName') as string;
    
    if (!profile?.organizationId || !vendorName) return;
    
    setIsAnalyzing('magic-adding');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Act as an Insurance GRC Expert. For the company "${vendorName}", determine:
      1. Business Category (e.g., Claims Processing, Policy Admin Systems, Cloud Infrastructure)
      2. Suggested Criticality (Critical, High, Medium, Low)
      3. A brief 1-sentence risk summary focusing on potential regulatory impact (e.g., NYDFS/NAIC).
      Return JSON: { category, criticality, reputation }`;

      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const info = JSON.parse(result.text || "{}");
      
      await addDoc(collection(db, 'vendors'), {
        name: vendorName,
        category: info.category || 'Third Party',
        criticality: info.criticality || 'Medium',
        reputation: info.reputation || 'Regulatory baseline assessment required.',
        status: 'Active',
        riskScore: 0,
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });
      
      setShowAddModal(false);
    } catch (e) {
      console.error("Magic add failed", e);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleExcelImport = async () => {
    if (!excelPaste.trim() || !profile?.organizationId) return;
    setIsAnalyzing('excel-importing');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `I have several rows copied from an Excel sheet for vendor management. 
      Text: "${excelPaste}"
      
      Task: Extract each unique company name and categorize them for an INSURANCE company's third-party risk program.
      Return a JSON array of vendors: [{ name, category, criticality }] (Max 10).`;

      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const extractedVendors = JSON.parse(result.text || "[]");
      
      for (const v of extractedVendors) {
        await addDoc(collection(db, 'vendors'), {
          ...v,
          status: 'Active',
          riskScore: 0,
          reputation: 'Migrated from legacy Excel program.',
          organizationId: profile.organizationId,
          createdAt: new Date().toISOString()
        });
      }
      
      setShowExcelModal(false);
      setExcelPaste('');
    } catch (e) {
      console.error("Excel import failed", e);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleAddVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setVendorFormError('');
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const criticality = formData.get('criticality') as Vendor['criticality'];

    if (!profile?.organizationId) return;

    if (!name.trim()) {
      setVendorFormError('Vendor name is required');
      return;
    }
    if (name.length < 2) {
      setVendorFormError('Vendor name is too short');
      return;
    }
    if (!category.trim()) {
      setVendorFormError('Category is required');
      return;
    }

    try {
      await addDoc(collection(db, 'vendors'), {
        name,
        category,
        criticality,
        status: 'Active',
        riskScore: 0,
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
    } catch (error) {
      console.error("Failed to add vendor:", error);
      setVendorFormError('Failed to save vendor to intelligence database.');
    }
  };

  const runAIAssessment = async (vendor: Vendor) => {
    setIsAnalyzing(vendor.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Perform a Regulatory Third-Party Risk Assessment for an INSURANCE environment: "${vendor.name}".
      Vendor Category: ${vendor.category}.
      
      Requirements to check:
      - NYDFS Part 500 (Cybersecurity)
      - NAIC Data Security Model Law
      - Solvency II (for EU partners)
      - Model Audit Rule (MAR)
      
      Target Audience: Chief Compliance Officers and Regulatory Heads.
      
      Return JSON: { 
        "summary": "Start with 'Regulatory Status: COMPLIANT', 'PARTIAL', or 'NON-COMPLIANT'. Follow with a 2-sentence executive summary focusing on insurance data protection.",
        "findings": ["3 compliance-specific findings (e.g. SOC2 Type II status, data residency for claims info, 4th-party risk)"],
        "score": 0-100,
        "type": "Regulatory Scorecard",
        "riskTier": "Tier 1",
        "complianceStatus": "Compliant",
        "briefing": "ClaimsPlus is a critical vendor with medium compliance maturity and missing MFA evidence."
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || "{}");
      
      await addDoc(collection(db, 'vendor_assessments'), {
        vendorId: vendor.id,
        type: result.type || 'Regulatory Scorecard',
        summary: result.summary || 'Initial scan completed.',
        findings: result.findings || [],
        score: result.score ?? 72,
        organizationId: profile?.organizationId,
        createdAt: new Date().toISOString()
      });

      const lastDate = new Date().toISOString().split('T')[0];
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 6);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      await updateDoc(doc(db, 'vendors', vendor.id), {
        riskScore: result.score ?? 72,
        trustScore: result.score ?? 72,
        riskTier: result.riskTier || (vendor.criticality === 'Critical' ? 'Tier 1' : 'Tier 2'),
        complianceStatus: result.complianceStatus || 'Compliant',
        lastAssessment: lastDate,
        nextAssessment: nextDateStr,
        briefing: result.briefing || `${vendor.name} is a ${vendor.criticality.toLowerCase()} partner with moderate compliance controls.`
      });

    } catch (error) {
      console.error("AI Assessment failed:", error);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display text-glow">
            Third-Party Command Center
          </h1>
          <p className="text-slate-400 mt-1 max-w-lg">
            Automated vendor monitoring and risk intelligence. No security expertise required.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={() => setShowExcelModal(true)} 
            className="text-slate-400 hover:text-white border border-white/5 hover:bg-white/5"
          >
            <FileText className="h-4 w-4 mr-2" />
            Migrate from Excel
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white border-glow px-6 font-bold">
            <Zap className="h-4 w-4 mr-2 fill-current" />
            Magic Add Vendor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {/* Regulatory Intelligence Banner */}
          <div className="glass-panel p-6 rounded-2xl border-indigo-500/20 bg-indigo-500/5 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
               <ShieldCheck className="h-24 w-24" />
            </div>
            <div className="relative z-10">
               <div className="flex items-center gap-2 mb-2">
                 <Badge className="bg-indigo-500 text-white font-bold p-1 rounded">INSURANCE INTEL</Badge>
                 <span className="text-xs text-slate-500 font-mono">LIVE REGULATORY TRACKER</span>
               </div>
               <h3 className="text-xl font-bold text-white mb-2">NAIC & NYDFS Part 500 Drift Identified</h3>
               <p className="text-slate-400 text-sm max-w-2xl">
                 Your current vendor portfolio shows a 14% deviation from the latest NAIC Data Security Model Law updates. Recommend running a re-assessment on critical cloud partners.
               </p>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-4 rounded-xl border-white/5 flex items-center gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-transform">
                 <ShieldCheck className="h-12 w-12" />
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Guardentra Trust Index</p>
                <p className="text-sm font-bold text-white">HEALTHY</p>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-xl border-white/5 flex items-center gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-transform">
                 <Zap className="h-12 w-12" />
              </div>
              <div className="p-3 rounded-full bg-amber-500/10 text-amber-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Audit Coverage</p>
                <p className="text-sm font-bold text-white">{Math.round((vendors.filter(v => v.riskScore > 0).length / (vendors.length || 1)) * 100)}% Scanned</p>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-xl border-white/5 bg-indigo-600/10 border-indigo-500/20 flex items-center gap-4 relative overflow-hidden group cursor-pointer hover:bg-indigo-600/20 transition-all">
              <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-400">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Procurement Summary</p>
                <p className="text-sm font-bold text-white flex items-center gap-1">
                  Download Report
                  <ExternalLink className="h-3 w-3" />
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Loading vendor landscape...</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500">
            <Building2 className="h-12 w-12 mb-4 opacity-20" />
            <p>No vendors found. Start by adding a third-party partner.</p>
          </div>
        ) : (
          filteredVendors.map((vendor) => (
            <motion.div 
              key={vendor.id}
              layout
              className={cn(
                "glass-panel rounded-xl border border-white/5 overflow-hidden transition-all duration-300",
                expandedVendor === vendor.id ? "ring-2 ring-indigo-500/50 lg:col-span-2" : "hover:border-white/20"
              )}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <Building2 className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{vendor.name}</h3>
                      <p className="text-xs text-slate-500">{vendor.category}</p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline"
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border",
                      vendor.criticality === 'Critical' ? "border-rose-500/30 text-rose-400 bg-rose-500/10 shadow-[0_0_8px_-2px_theme(colors.rose.500)]" :
                      vendor.criticality === 'High' ? "border-orange-500/30 text-orange-400 bg-orange-500/10 shadow-[0_0_8px_-2px_theme(colors.orange.500)]" :
                      vendor.criticality === 'Medium' ? "border-amber-500/30 text-amber-400 bg-amber-500/10 shadow-[0_0_8px_-2px_theme(colors.amber.500)]" :
                      "border-blue-500/30 text-blue-400 bg-blue-500/10 shadow-[0_0_8px_-2px_theme(colors.blue.500)]"
                    )}
                  >
                    {vendor.criticality}
                  </Badge>
                </div>

                {/* Explainable Guardentra Trust Index score scorecard (Priority 4) */}
                <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-4 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-3">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest font-mono">Explainable Trust Score Drivers</span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className={cn(
                          "text-3xl font-extrabold font-mono",
                          (vendor.riskScore || 74) > 80 ? "text-emerald-400 text-glow" : (vendor.riskScore || 74) > 60 ? "text-amber-400" : "text-rose-400"
                        )}>
                          {vendor.riskScore || 74}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">/ 100</span>
                      </div>
                    </div>
                    {/* Visual meter */}
                    <div className="flex-1 max-w-[220px] w-full min-w-[140px] bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          (vendor.riskScore || 74) > 80 ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : (vendor.riskScore || 74) > 60 ? "bg-amber-400" : "bg-rose-500"
                        )}
                        style={{ width: `${vendor.riskScore || 74}%` }}
                      />
                    </div>
                  </div>

                  {/* Drivers Indicators */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider block font-mono">Credentials Mapped</span>
                      <span className="text-[11px] text-white font-medium flex items-center gap-1.5 mt-0.5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        8/8 verified
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider block font-mono">Evidence Attested</span>
                      <span className="text-[11px] text-white font-medium flex items-center gap-1.5 mt-0.5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Compliance current
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider block font-mono">Dual-Factor Protection</span>
                      <span className="text-[11px] text-white font-medium flex items-center gap-1.5 mt-0.5 font-mono">
                        <span className={cn("w-1.5 h-1.5 rounded-full", (vendor.riskScore || 74) > 85 ? "bg-emerald-500" : "bg-amber-500")} />
                        {(vendor.riskScore || 74) > 85 ? "Active" : "Recommended MFA"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider block font-mono">Incident Margin</span>
                      <span className="text-[11px] text-white font-medium flex items-center gap-1.5 mt-0.5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Optimal limit
                      </span>
                    </div>
                  </div>
                </div>

                {vendor.reputation && (
                  <div className="mb-6 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                    <p className="text-[10px] text-indigo-400 uppercase font-bold mb-1 flex items-center gap-1">
                       <Sparkles className="h-3 w-3" />
                       Intelligence Insights
                    </p>
                    <p className="text-[11px] text-slate-400 italic">"{vendor.reputation}"</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white border-white/10"
                    onClick={() => {
                      setExpandedVendor(expandedVendor === vendor.id ? null : vendor.id);
                      fetchAssessments(vendor.id);
                    }}
                  >
                    <FileSearch className="h-4 w-4 mr-2" />
                    {expandedVendor === vendor.id ? 'Close Workspace' : 'Open Workspace'}
                  </Button>
                  <Button 
                    className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/30"
                    onClick={() => runAIAssessment(vendor)}
                    disabled={isAnalyzing === vendor.id}
                  >
                    {isAnalyzing === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Integrated Modular Workspace Tabs & Panes (Priority 3, 5, 6) */}
              <AnimatePresence>
                {expandedVendor === vendor.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5 bg-black/45"
                  >
                    <div className="p-6 space-y-6">
                      
                      {/* Sub Tabs Selection */}
                      <div className="flex border-b border-white/5 pb-1 gap-2 md:gap-4 overflow-x-auto scrollbar-thin">
                        {[
                          { id: 'overview', label: 'Overview', icon: FileText },
                          { id: 'risk', label: 'Risk Info', icon: ShieldAlert },
                          { id: 'evidence', label: 'Evidence', icon: Lock },
                          { id: 'remediation', label: 'Remediation', icon: Wrench },
                          { id: 'monitoring', label: 'Monitoring', icon: Bell },
                          { id: 'audit_history', label: 'Audit History', icon: History },
                        ].map((t) => {
                          const activeTab = workSpacesTabs[vendor.id] || 'overview';
                          const IconComp = t.icon;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setWorkSpacesTabs(prev => ({ ...prev, [vendor.id]: t.id as any }))}
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider pb-3 px-1 relative transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border-b-2",
                                activeTab === t.id 
                                  ? "text-indigo-400 border-indigo-500 font-bold" 
                                  : "text-slate-500 border-transparent hover:text-slate-300"
                              )}
                            >
                              <IconComp className="h-3.5 w-3.5" />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Tab 1: Overview */}
                      {(workSpacesTabs[vendor.id] || 'overview') === 'overview' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          {/* AI-generated Briefing Component */}
                          <div className="relative group overflow-hidden rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 shadow-md">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                              <Sparkles className="h-10 w-10 text-indigo-400" />
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold px-2 py-0.5 text-[9px] uppercase tracking-wider">AI Vendor Briefing</Badge>
                              <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">Active posture synthesis</span>
                            </div>
                            <h4 className="text-white text-xs md:text-sm font-semibold leading-relaxed">
                              "{vendor.briefing || `${vendor.name} is a ${vendor.criticality.toLowerCase()} vendor with ${(vendor.riskScore || 74) > 80 ? 'high' : (vendor.riskScore || 74) > 60 ? 'medium' : 'low'} compliance maturity and ${(vendor.riskScore || 74) < 85 ? 'missing MFA evidence' : 'complete SOC 2 verification'}.`}"
                            </h4>
                          </div>

                          {/* Elegant 8 Fields Specification Grid */}
                          <div>
                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block font-mono mb-3">Vendor Specifications Profile</span>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                { label: 'Vendor Name', value: vendor.name },
                                { label: 'Category', value: vendor.category || 'Strategic Partner' },
                                { label: 'Criticality', value: vendor.criticality, isBadge: true, badgeType: 'criticality' },
                                { label: 'Risk Tier', value: vendor.riskTier ?? (vendor.criticality === 'Critical' ? 'Tier 1' : vendor.criticality === 'High' ? 'Tier 2' : vendor.criticality === 'Medium' ? 'Tier 3' : 'Tier 4') },
                                { label: 'Trust Score', value: `${vendor.trustScore ?? vendor.riskScore ?? 74} / 100`, isMono: true },
                                { label: 'Compliance Status', value: vendor.complianceStatus ?? ((vendor.riskScore || 74) > 80 ? 'Compliant' : (vendor.riskScore || 74) > 60 ? 'Partial' : 'Non-Compliant'), isBadge: true, badgeType: 'compliance' },
                                { label: 'Last Assessment', value: vendor.lastAssessment ?? '2026-03-15', isMono: true },
                                { label: 'Next Assessment', value: vendor.nextAssessment ?? '2026-09-15', isMono: true },
                              ].map((field, idx) => (
                                <div key={idx} className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1">
                                  <span className="text-[8px] text-slate-500 uppercase font-mono block">{field.label}</span>
                                  {field.isBadge ? (
                                    field.badgeType === 'criticality' ? (
                                      <Badge className={cn(
                                        "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border font-mono mt-0.5",
                                        field.value === 'Critical' ? "border-rose-500/30 text-rose-400 bg-rose-500/10" :
                                        field.value === 'High' ? "border-orange-500/30 text-orange-400 bg-orange-500/10" :
                                        field.value === 'Medium' ? "border-amber-500/30 text-amber-400 bg-amber-500/10" :
                                        "border-blue-500/30 text-blue-400 bg-blue-500/10"
                                      )}>
                                        {field.value}
                                      </Badge>
                                    ) : (
                                      <Badge className={cn(
                                        "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border font-mono mt-0.5",
                                        field.value === 'Compliant' || field.value === 'COMPLIANT' ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" :
                                        field.value === 'Partial' || field.value === 'PARTIAL' ? "border-amber-500/30 text-amber-400 bg-amber-500/10" :
                                        "border-rose-500/30 text-rose-400 bg-rose-500/10"
                                      )}>
                                        {field.value}
                                      </Badge>
                                    )
                                  ) : (
                                    <p className={cn("text-xs text-white font-medium", field.isMono && "font-mono font-bold")}>
                                      {field.value}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Risk Tab */}
                      {(workSpacesTabs[vendor.id] || 'overview') === 'risk' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <div>
                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block font-mono mb-1">Detailed Risk Vectors Matrix</span>
                            <p className="text-xs text-slate-400">Quantitative cyber governance, operational reliability, regulatory drift and compliance risk assessment scores.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                              { 
                                name: 'Cyber Risk', 
                                score: getDynamicRiskProfile(vendor).cyber, 
                                desc: 'Checks infrastructure protection metrics, penetration testing timelines, firewall rules, and vulnerability sweep rates.',
                                gradient: 'from-rose-500/10 to-transparent',
                                border: 'border-rose-500/20',
                                text: 'text-rose-400'
                              },
                              { 
                                name: 'Compliance Risk', 
                                score: getDynamicRiskProfile(vendor).compliance, 
                                desc: 'Measures adherence to NYDFS Part 500, NAIC Data Law guidelines, and Model Audit Rule procedures.',
                                gradient: 'from-amber-500/10 to-transparent',
                                border: 'border-amber-500/20',
                                text: 'text-amber-400'
                              },
                              { 
                                name: 'Operational Risk', 
                                score: getDynamicRiskProfile(vendor).operational, 
                                desc: 'Tracks subkey identity logs, data separation mechanisms, service level latency, and BCP failovers.',
                                gradient: 'from-orange-500/10 to-transparent',
                                border: 'border-orange-500/20',
                                text: 'text-orange-400'
                              },
                              { 
                                name: 'Environmental Risk', 
                                score: getDynamicRiskProfile(vendor).environmental, 
                                desc: 'Validates claims data residency protections, physical data center configurations, and server efficiency guidelines.',
                                gradient: 'from-emerald-500/10 to-transparent',
                                border: 'border-emerald-500/20',
                                text: 'text-emerald-400'
                              }
                            ].map((risk, idx) => (
                              <div key={idx} className={cn("p-5 rounded-2xl border bg-gradient-to-br space-y-3", risk.gradient, risk.border)}>
                                <div className="flex justify-between items-center">
                                  <h5 className="text-xs font-bold text-white uppercase tracking-wider">{risk.name}</h5>
                                  <span className={cn("text-lg font-mono font-extrabold", risk.text)}>{risk.score}%</span>
                                </div>
                                <p className="text-xs text-slate-400 leading-normal">{risk.desc}</p>
                                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className={cn("h-full rounded-full", 
                                      risk.score > 75 ? "bg-rose-500" : risk.score > 40 ? "bg-amber-500" : "bg-emerald-500"
                                    )} 
                                    style={{ width: `${risk.score}%` }} 
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tab 3: Evidence Tab */}
                      {(workSpacesTabs[vendor.id] || 'overview') === 'evidence' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          {/* Title dashboard section */}
                          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-slate-950/20 p-5 rounded-2xl border border-white/5">
                            <div>
                              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block font-mono">
                                Guardentra AI Evidence Review Engine
                              </span>
                              <h3 className="text-base font-bold text-white mt-1">Audit Policy & Evidence Assets</h3>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Run instant GRC audits of SOC 2 audits, ISO certifications, security plans, and self-assessments using real-world compliance criteria.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 self-start lg:self-center">
                              <Badge className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[9px] uppercase font-mono font-bold py-1 px-2.5 rounded-lg">
                                Active Compliance Guard: {vendor.complianceStatus || 'Compliant'}
                              </Badge>
                            </div>
                          </div>

                          {/* Split screen logic */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left Panel: Upload, selector, and analyze */}
                            <div className="lg:col-span-8 space-y-6">
                              <div className="p-6 rounded-2xl bg-slate-950/40 border border-white/5 space-y-5">
                                <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                                  Step 1: Configure Assessment Asset
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Select GRC type */}
                                  <div className="space-y-2">
                                    <label className="text-[10px] text-slate-400 font-mono font-bold uppercase block">
                                      Compliance Document Category
                                    </label>
                                    <select
                                      value={reviewDocs[vendor.id]?.type || 'SOC 2 Reports'}
                                      onChange={(e) => {
                                        const typeVal = e.target.value;
                                        const templateData = GRC_DOC_TEMPLATES[typeVal];
                                        setReviewDocs(prev => ({
                                          ...prev,
                                          [vendor.id]: {
                                            type: typeVal,
                                            name: templateData ? templateData.name : 'policy_exhibit.txt',
                                            content: templateData ? templateData.content : ''
                                          }
                                        }));
                                      }}
                                      className="w-full h-10 rounded-lg bg-slate-900 border border-white/5 hover:border-white/10 transition-colors text-xs text-white px-3 focus:outline-none focus:border-indigo-500"
                                    >
                                      <option value="SOC 2 Reports">SOC 2 Type II Reports</option>
                                      <option value="ISO Certificates">ISO Certificate / Attestations</option>
                                      <option value="Security Policies">Corporate Security Policies</option>
                                      <option value="Vendor Questionnaires">Risk Surveys / Questionnaires</option>
                                      <option value="Audit Reports">Historical Audit Assessments</option>
                                    </select>
                                  </div>

                                  {/* Select Pre-populated GRC preset template */}
                                  <div className="space-y-2">
                                    <label className="text-[10px] text-slate-400 font-mono font-bold uppercase block">
                                      Rapid Test Preset
                                    </label>
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => {
                                          const activeType = reviewDocs[vendor.id]?.type || 'SOC 2 Reports';
                                          const template = GRC_DOC_TEMPLATES[activeType];
                                          if (template) {
                                            setReviewDocs(prev => ({
                                              ...prev,
                                              [vendor.id]: {
                                                type: activeType,
                                                name: template.name,
                                                content: template.content
                                              }
                                            }));
                                          }
                                        }}
                                        variant="outline"
                                        className="h-10 flex-1 border-white/5 hover:border-indigo-500/20 text-[10px] uppercase font-bold tracking-wider text-slate-300 hover:text-white bg-white/[0.01] cursor-pointer"
                                      >
                                        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
                                        Feed Blueprint Template
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                {/* Drag and drop upload helper */}
                                <div className="space-y-2">
                                  <label className="text-[10px] text-slate-400 font-mono font-bold uppercase block">
                                    File Attestation Source
                                  </label>
                                  
                                  <div
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const file = e.dataTransfer.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                          const text = event.target?.result as string;
                                          const name = file.name;
                                          // Match simple type by name
                                          let docTypeMatched = 'Security Policies';
                                          if (name.toLowerCase().includes('soc')) docTypeMatched = 'SOC 2 Reports';
                                          else if (name.toLowerCase().includes('iso')) docTypeMatched = 'ISO Certificates';
                                          else if (name.toLowerCase().includes('questionnaire') || name.toLowerCase().includes('survey')) docTypeMatched = 'Vendor Questionnaires';
                                          else if (name.toLowerCase().includes('audit')) docTypeMatched = 'Audit Reports';

                                          setReviewDocs(prev => ({
                                            ...prev,
                                            [vendor.id]: {
                                              type: docTypeMatched,
                                              name,
                                              content: text || 'Loaded compliance report document.'
                                            }
                                          }));
                                        };
                                        reader.readAsText(file);
                                      }
                                    }}
                                    className="p-5 rounded-xl border border-dashed border-white/10 hover:border-indigo-500/20 bg-white/[0.01] hover:bg-white/[0.02] transition-all flex flex-col items-center justify-center text-center cursor-pointer relative"
                                  >
                                    <input
                                      type="file"
                                      id={`file-upload-picker-${vendor.id}`}
                                      className="hidden"
                                      accept=".txt,.json,.md,.html,.csv"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            const text = ev.target?.result as string;
                                            setReviewDocs(prev => ({
                                              ...prev,
                                              [vendor.id]: {
                                                type: reviewDocs[vendor.id]?.type || 'SOC 2 Reports',
                                                name: file.name,
                                                content: text || ''
                                              }
                                            }));
                                          };
                                          reader.readAsText(file);
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor={`file-upload-picker-${vendor.id}`}
                                      className="cursor-pointer w-full h-full flex flex-col items-center justify-center pointer-events-auto"
                                    >
                                      <FileText className="h-7 w-7 text-indigo-400 mb-1.5" />
                                      <span className="text-xs font-semibold text-white">
                                        Drag & Drop or Click to Select File
                                      </span>
                                      <span className="text-[10px] text-slate-500 mt-1 uppercase font-mono font-bold">
                                        Active upload targets: .txt, .json, .md
                                      </span>
                                    </label>
                                  </div>
                                </div>

                                {/* Text content preview box */}
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono font-bold uppercase">
                                    <span>Raw GRC Material Analysis View</span>
                                    {reviewDocs[vendor.id]?.name && (
                                      <span className="text-indigo-400 text-xs font-semibold uppercase">
                                        FILE: {reviewDocs[vendor.id]?.name}
                                      </span>
                                    )}
                                  </div>
                                  <textarea
                                    value={reviewDocs[vendor.id]?.content || ''}
                                    onChange={(e) => {
                                      setReviewDocs(prev => ({
                                        ...prev,
                                        [vendor.id]: {
                                          type: reviewDocs[vendor.id]?.type || 'SOC 2 Reports',
                                          name: reviewDocs[vendor.id]?.name || 'policy_custom.txt',
                                          content: e.target.value
                                        }
                                      }));
                                    }}
                                    placeholder="Select a rapid preset blueprint above or drag in the document text content of your target GRC policy here."
                                    className="w-full h-32 rounded-lg bg-slate-900 border border-white/5 p-3 text-xs text-slate-300 font-sans focus:outline-none focus:border-indigo-500 overflow-y-auto placeholder:text-slate-600 leading-relaxed resize-none"
                                  />
                                </div>

                                {/* Error handling */}
                                {reviewError[vendor.id] && (
                                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{reviewError[vendor.id]}</span>
                                  </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex justify-end pt-2">
                                  <Button
                                    onClick={() => handleAnalyzeEvidence(vendor.id, vendor.name)}
                                    disabled={isReviewing[vendor.id]}
                                    className="w-full sm:w-auto h-10 px-6 font-bold uppercase tracking-wider text-xs select-none cursor-pointer bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg disabled:opacity-50"
                                  >
                                    {isReviewing[vendor.id] ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Running Trust Compliance Audit...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-4 w-4 mr-2 text-yellow-300" />
                                        Analyze with Guardentra AI
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Right Panel: Historic reports tracking list */}
                            <div className="lg:col-span-4 space-y-4">
                              <div className="p-6 rounded-2xl bg-slate-950/40 border border-white/5 space-y-4">
                                <div>
                                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                                    Audit Trails & History
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Vetting registry history of previously reviewed policy documents.
                                  </p>
                                </div>

                                {(!historicReviews[vendor.id] || historicReviews[vendor.id].length === 0) ? (
                                  <div className="py-12 border border-dashed border-white/5 rounded-xl text-center text-[11px] text-slate-500">
                                    No previously saved reviews are registered for this partner.
                                  </div>
                                ) : (
                                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                                    {historicReviews[vendor.id].map((record) => (
                                      <div
                                        key={record.id}
                                        className={cn(
                                          "p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-2.5",
                                          viewingHistoricReview[vendor.id]?.id === record.id
                                            ? "border-indigo-500/40 bg-indigo-500/5 shadow-[0_0_10px_rgba(99,102,241,0.1)]"
                                            : "border-white/5 bg-white/[0.01] hover:border-white/10"
                                        )}
                                        onClick={() => {
                                          setViewingHistoricReview(prev => ({ ...prev, [vendor.id]: record }));
                                          // also load this as active so the central detail view opens it!
                                          setActiveReviews(prev => ({ ...prev, [vendor.id]: record.result }));
                                          setSavedStatus(prev => ({ ...prev, [vendor.id]: true }));
                                        }}
                                      >
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <div className="flex items-center gap-1.5">
                                              <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                              <span className="text-[11px] font-bold text-white line-clamp-1">{record.fileName}</span>
                                            </div>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-mono mt-0.5">
                                              {record.documentType}
                                            </span>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteReview(vendor.id, record.id);
                                            }}
                                            className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-rose-500/10 text-rose-400 transition-colors"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>

                                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                                          <span>SIGNAL: </span>
                                          <span className={cn(
                                            "font-bold uppercase",
                                            record.result?.complianceSignal === 'Compliant' ? 'text-emerald-400' :
                                            record.result?.complianceSignal === 'Partial' ? 'text-amber-400' : 'text-rose-400'
                                          )}>
                                            {record.result?.complianceSignal}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Analysis inline reports widgets */}
                          {(activeReviews[vendor.id] || viewingHistoricReview[vendor.id]) && (
                            <div className="space-y-6 pt-2 animate-in slide-in-from-bottom duration-300">
                              <div className="border-t border-white/5 pt-6">
                                <h4 className="text-xs font-bold text-white font-mono uppercase tracking-widest text-center flex items-center justify-center gap-2 mb-6">
                                  <Sparkles className="h-4 w-4 text-indigo-400" />
                                  Vetting Report Exhibit Insights
                                </h4>
                              </div>

                              {/* Document summary executive overview card */}
                              <EvidenceSummaryCard
                                result={activeReviews[vendor.id] || viewingHistoricReview[vendor.id]!.result}
                                documentType={reviewDocs[vendor.id]?.type || (viewingHistoricReview[vendor.id] ? viewingHistoricReview[vendor.id]!.documentType : 'SOC 2 Reports')}
                                fileName={reviewDocs[vendor.id]?.name || (viewingHistoricReview[vendor.id] ? viewingHistoricReview[vendor.id]!.fileName : 'exhibit_doc.txt')}
                                vendorName={vendor.name}
                                isSaved={savedStatus[vendor.id]}
                                isSaving={saveLoading[vendor.id]}
                                onSave={() => handleSaveReview(
                                  vendor.id,
                                  reviewDocs[vendor.id]?.type || 'SOC 2 Reports',
                                  reviewDocs[vendor.id]?.name || 'audit_comply.txt'
                                )}
                              />

                              {/* Findings detail card */}
                              <EvidenceFindingCard
                                findings={(activeReviews[vendor.id] || viewingHistoricReview[vendor.id]!.result).keyFindings}
                                detectedRisks={(activeReviews[vendor.id] || viewingHistoricReview[vendor.id]!.result).detectedRisks}
                                isRemediating={isAddingFindingTicket[vendor.id]}
                                onRemediate={(finding, impact) => handleRemediateFinding(vendor.id, finding, impact)}
                              />

                              {/* Gap control verification card */}
                              <EvidenceGapCard
                                gaps={(activeReviews[vendor.id] || viewingHistoricReview[vendor.id]!.result).missingEvidence}
                                vendorName={vendor.name}
                                onSendOutreach={(sub, b) => {
                                  console.log("Transmitted Outreach Template:", sub, b);
                                }}
                              />

                              {/* Prescriptive recommendations card */}
                              <EvidenceRecommendationCard
                                recommendations={(activeReviews[vendor.id] || viewingHistoricReview[vendor.id]!.result).recommendations}
                                activeAddedItems={remediationTicketsLogged[vendor.id] || []}
                                onAddActionItem={(action_text, timeframe, difficulty) => {
                                  // Log remediations track record
                                  setRemediationTicketsLogged(prev => ({
                                    ...prev,
                                    [vendor.id]: [...(prev[vendor.id] || []), action_text]
                                  }));
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tab 4: Remediation Tab */}
                      {(workSpacesTabs[vendor.id] || 'overview') === 'remediation' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <RemediationEngine
                            vendorId={vendor.id}
                            vendorName={vendor.name}
                            originalFindings={getDynamicFindingsList(vendor).map(item => ({
                              finding: item.finding,
                              recommendation: item.recommendation
                            }))}
                          />
                        </div>
                      )}

                      {/* Tab 5: Monitoring Tab */}
                      {(workSpacesTabs[vendor.id] || 'overview') === 'monitoring' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <div>
                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block font-mono">Continuous Monitoring Feed</span>
                            <p className="text-xs text-slate-400 mt-1">Real-time telemetry alerts, active certificate timers, and compliance reassessment triggers.</p>
                          </div>

                          <div className="space-y-3">
                            {getDynamicMonitoringAlerts(vendor).map((alert) => (
                              <div key={alert.id} className="p-4 rounded-xl bg-slate-950/40 border border-white/5 flex gap-4 items-start">
                                <div className={cn(
                                  "p-2 rounded-lg mt-0.5 shrink-0",
                                  alert.severity === 'Critical' ? "bg-rose-500/10 text-rose-400" :
                                  alert.severity === 'High' ? "bg-orange-500/10 text-orange-400" :
                                  alert.severity === 'Medium' ? "bg-amber-500/10 text-amber-400" :
                                  "bg-blue-500/10 text-blue-400"
                                )}>
                                  <Bell className="h-4 w-4" />
                                </div>
                                <div className="space-y-1 flex-1">
                                  <div className="flex justify-between items-start gap-4">
                                    <h5 className="text-xs font-bold text-white uppercase tracking-wide">
                                      [{alert.type}] {alert.title}
                                    </h5>
                                    <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap">{alert.date}</span>
                                  </div>
                                  <p className="text-xs text-slate-400 leading-normal">{alert.description}</p>
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[9px] font-mono text-slate-600 uppercase font-semibold">Severity</span>
                                    <Badge className={cn(
                                      "text-[8px] font-bold uppercase tracking-widest",
                                      alert.severity === 'Critical' ? "bg-rose-500/10 text-rose-300 border border-rose-500/20" :
                                      alert.severity === 'High' ? "bg-orange-500/10 text-orange-300 border border-orange-500/20" :
                                      "bg-slate-850 text-slate-400"
                                    )}>
                                      {alert.severity}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tab 6: Audit History Tab */}
                      {(workSpacesTabs[vendor.id] || 'overview') === 'audit_history' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block font-mono">Chronological Audit Record Logs</span>
                              <p className="text-xs text-slate-400 mt-1">Immutable execution timelines of policy scoring runs, attestation validations, and administrative scans.</p>
                            </div>
                            <Badge className="bg-white/5 border border-white/10 text-slate-400 font-mono text-[9px] uppercase font-bold">
                              Archived Trace
                            </Badge>
                          </div>

                          <div className="relative border-l border-white/10 ml-3 pl-6 space-y-6">
                            {getDynamicAuditHistory(vendor).map((record, index) => (
                              <div key={record.id} className="relative group">
                                {/* Timeline Dot */}
                                <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-black shadow-[0_0_8px_rgba(99,102,241,0.6)] group-hover:scale-125 transition-transform" />
                                
                                <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-2">
                                  <div className="flex justify-between items-start gap-4 flex-wrap">
                                    <span className="text-xs font-bold text-white font-mono leading-tight">{record.activity}</span>
                                    <span className="text-[9px] text-slate-500 font-mono">{record.date}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1">
                                    <span className="flex items-center gap-1 font-mono uppercase tracking-widest text-[8px] text-slate-600">
                                      Triggered By
                                    </span>
                                    <span className="text-indigo-300">{record.by}</span>
                                    <span className="h-2 w-[1px] bg-white/10" />
                                    <span className="flex items-center gap-1 font-mono uppercase tracking-widest text-[8px] text-slate-600">
                                      Resolution State
                                    </span>
                                    <span className="text-emerald-400 font-mono">{record.status}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
          </div>
        </div>

        {/* Global Intelligence Feed side panel */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-400 animate-pulse" />
              Global Intel Feed
            </h2>
            <Button variant="ghost" size="sm" onClick={refreshVendorIntelligence} disabled={isRefreshingNews}>
              <RefreshCw className={cn("h-4 w-4 text-slate-500", isRefreshingNews && "animate-spin")} />
            </Button>
          </div>

          <div className="space-y-4">
            {isRefreshingNews ? (
              [1, 2, 3].map(i => (
                <div key={i} className="glass-panel p-5 rounded-xl border border-white/5 animate-pulse h-32 bg-white/[0.02]" />
              ))
            ) : vendorNews.length > 0 ? (
              vendorNews.map((news, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-panel p-5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all group relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Newspaper className="h-10 w-10" />
                   </div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{news.vendor}</span>
                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase border",
                        news.severity === 'Critical' ? "border-rose-500/30 text-rose-500 bg-rose-500/10 shadow-[0_0_8px_-2px_theme(colors.rose.500)]" :
                        news.severity === 'High' ? "border-orange-500/30 text-orange-500 bg-orange-500/10 shadow-[0_0_8px_-2px_theme(colors.orange.500)]" :
                        "border-amber-500/30 text-amber-500 bg-amber-500/10 shadow-[0_0_8px_-2px_theme(colors.amber.500)]"
                      )}
                    >
                      {news.severity}
                    </Badge>
                  </div>
                  <h3 className="text-xs font-bold text-white mb-2 leading-tight group-hover:text-primary transition-colors underline-offset-4 decoration-primary/20 hover:underline">{news.title}</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 italic font-serif mb-3">"{news.summary}"</p>
                  
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 mb-4">
                     <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Recommended Action</p>
                     <p className="text-[10px] text-slate-300 font-medium">{news.action}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[9px] text-slate-600">
                      <ShieldAlert className="h-3 w-3" />
                      Global Intel • {news.date}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-primary font-bold uppercase tracking-widest hover:bg-primary/5">
                      Dismiss
                    </Button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-12 text-center glass-panel rounded-xl border border-white/5 border-dashed border-slate-800">
                <Globe className="h-10 w-10 text-slate-800 mx-auto mb-4" />
                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Connect profiles to sync feed</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Excel Import Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel max-w-2xl w-full p-8 rounded-3xl border border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
               <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <FileText className="h-6 w-6 text-emerald-400" />
                    Stop Manual Spreadsheets
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">Paste your current Excel rows below. AI will bridge them into the platform.</p>
               </div>
               <Button variant="ghost" onClick={() => setShowExcelModal(false)} className="text-slate-500 hover:text-white">✕</Button>
            </div>

            <div className="space-y-6">
               <div className="relative">
                 <textarea 
                   className="w-full h-64 bg-black/40 border border-white/10 rounded-2xl p-6 text-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none transition-all placeholder:text-slate-700"
                   placeholder="Example: &#10;ClaimsPlus Inc | Claims Processing | Critical &#10;InsurOps Ltd | Policy Admin | High..."
                   value={excelPaste}
                   onChange={(e) => setExcelPaste(e.target.value)}
                 />
                 <div className="absolute top-4 right-4 text-[10px] uppercase font-bold text-slate-600 bg-white/5 px-2 py-1 rounded">Raw Paste Buffer</div>
               </div>

               <div className="flex gap-4">
                  <Button variant="ghost" className="flex-1 text-slate-400" onClick={() => setShowExcelModal(false)}>Keep Excel (Not Recommended)</Button>
                  <Button 
                    disabled={isAnalyzing === 'excel-importing' || !excelPaste.trim()}
                    onClick={handleExcelImport}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12"
                  >
                    {isAnalyzing === 'excel-importing' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Convert to Intelligent Database
                  </Button>
               </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="glass-panel max-w-lg w-full p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Zap className="h-32 w-32" />
            </div>

            <div className="flex items-center justify-between mb-8">
               <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Add New Partner</h2>
                  <p className="text-slate-400 text-sm mt-1">Magic intelligence will handle the background check.</p>
               </div>
               <Button variant="ghost" onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white">✕</Button>
            </div>

            <div className="space-y-8">
               {/* Magic Add Section */}
               <form onSubmit={handleMagicAdd} className="space-y-4">
                  {vendorFormError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                      {vendorFormError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Company Magic Search</label>
                    <div className="flex gap-2">
                       <Input 
                         name="magicName" 
                         placeholder="Enter company name (e.g. OpenAI)..." 
                         disabled={isAnalyzing === 'magic-adding'}
                         required 
                         className="h-12 bg-black/20 border-indigo-500/20 text-white focus:border-indigo-500" 
                       />
                       <Button 
                         type="submit" 
                         disabled={isAnalyzing === 'magic-adding'}
                         className="h-12 bg-indigo-600 hover:bg-indigo-500 text-white px-6"
                       >
                          {isAnalyzing === 'magic-adding' ? <Loader2 className="h-5 w-5 animate-spin" /> : "Auto-Identify"}
                       </Button>
                    </div>
                  </div>
               </form>

               <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-tighter text-slate-700"><span className="px-2 bg-slate-900/40 rounded">Or Manual Onboarding</span></div>
               </div>

               <form onSubmit={handleAddVendor} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Official Name</label>
                        <Input name="name" placeholder="Legal Name" required className="bg-black/20 border-white/10 text-white h-11" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Industry Category</label>
                        <Input name="category" placeholder="e.g. Cloud" required className="bg-black/20 border-white/10 text-white h-11" />
                     </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Operational Criticality</label>
                    <select 
                      name="criticality"
                      className="w-full h-11 px-3 rounded-md bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                    >
                      <option value="Critical">Critical (Can shut down our ops)</option>
                      <option value="High">High (Major dependency)</option>
                      <option value="Medium">Medium (Occasional use)</option>
                      <option value="Low">Low (Administrative/Public)</option>
                    </select>
                  </div>
                  
                  <Button type="submit" className="w-full h-12 bg-white text-black hover:bg-slate-200 mt-4 font-bold flex items-center justify-center gap-2">
                    <Plus className="h-4 w-4" />
                    Onboard Partner
                  </Button>
               </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
