import React, { useState, useEffect } from 'react';
import { useDemo, DemoMode } from '../lib/DemoContext';
import { 
  Shield, 
  Building2, 
  Sparkles, 
  Database, 
  Zap, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Globe, 
  UploadCloud, 
  Plus, 
  Bookmark, 
  Lock, 
  UserCheck, 
  Copy, 
  Check, 
  HelpCircle,
  Eye,
  TrendingUp,
  FileCheck,
  RotateCw,
  FolderOpen,
  ArrowRight,
  MapPin,
  Fingerprint,
  Users
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';

// Mock list of sector-specific vendors
const MOCK_SECTOR_VENDORS: Record<DemoMode, Array<any>> = {
  dhs: [
    {
      id: 'dhs-v1',
      name: 'GridLock SCADA Systems',
      sector: 'Energy / Power Grid',
      category: 'Industrial IoT Control Software',
      cyberScore: 48,
      complianceScore: 52,
      operationalScore: 58,
      environmentalScore: 80,
      overallScore: 56,
      status: 'Critical',
      lastAssessment: '2026-05-15',
      recommendedAction: 'Isolate SCADA endpoints; initiate CISA physical asset telemetry audit.'
    },
    {
      id: 'dhs-v2',
      name: 'Sovereign SecureComm',
      sector: 'Defense Aerospace',
      category: 'Tactical Communication Encryption',
      cyberScore: 98,
      complianceScore: 95,
      operationalScore: 94,
      environmentalScore: 88,
      overallScore: 94,
      status: 'Low',
      lastAssessment: '2026-05-20',
      recommendedAction: 'Maintain bi-weekly automated access key integrity monitoring.'
    },
    {
      id: 'dhs-v3',
      name: 'CryptoPass Federal',
      sector: 'Information Technology',
      category: 'Federated Single Sign-On Provider',
      cyberScore: 78,
      complianceScore: 80,
      operationalScore: 68,
      environmentalScore: 90,
      overallScore: 79,
      status: 'Medium',
      lastAssessment: '2026-05-28',
      recommendedAction: 'Schedule NIST 800-53 multi-factor authentication re-verification.'
    }
  ],
  commerce: [
    {
      id: 'comm-v1',
      name: 'SinoPrecision Foundry',
      sector: 'Microelectronics / CHIPS',
      category: 'Silicon Substrate Supplier',
      cyberScore: 54,
      complianceScore: 48,
      operationalScore: 40,
      environmentalScore: 65,
      overallScore: 49,
      status: 'Critical',
      lastAssessment: '2026-05-10',
      recommendedAction: 'Establish alternative domestic supplier; conduct BIS export restriction audit.'
    },
    {
      id: 'comm-v2',
      name: 'Atlantic Logistics Hub',
      sector: 'Transportation / Shipping',
      category: 'Multimodal Dry Freight Network',
      cyberScore: 82,
      complianceScore: 88,
      operationalScore: 92,
      environmentalScore: 72,
      overallScore: 84,
      status: 'Medium',
      lastAssessment: '2026-05-24',
      recommendedAction: 'Implement continuous tracking API integrations for shipment redundancy.'
    },
    {
      id: 'comm-v3',
      name: 'EuroAssemblers GMBH',
      sector: 'Advanced Machinery',
      category: 'Robotic Arms & Automation',
      cyberScore: 89,
      complianceScore: 91,
      operationalScore: 85,
      environmentalScore: 92,
      overallScore: 89,
      status: 'Low',
      lastAssessment: '2026-05-27',
      recommendedAction: 'Approve procurement extension; review annual ISO 27001 certificate.'
    }
  ],
  epa: [
    {
      id: 'epa-v1',
      name: 'HydroPure Chemical Depot',
      sector: 'Water Supply / Utilities',
      category: 'Water Treatment Reagent Supplier',
      cyberScore: 68,
      complianceScore: 50,
      operationalScore: 74,
      environmentalScore: 35,
      overallScore: 53,
      status: 'Critical',
      lastAssessment: '2026-05-08',
      recommendedAction: 'Mandate immediate chemical asset isolation compliance and Clean Water Act reporting.'
    },
    {
      id: 'epa-v2',
      name: 'EcoCycle Disposal Partners',
      sector: 'Waste Management',
      category: 'Hazardous Sludge Incineration',
      cyberScore: 84,
      complianceScore: 96,
      operationalScore: 90,
      environmentalScore: 95,
      overallScore: 92,
      status: 'Low',
      lastAssessment: '2026-05-22',
      recommendedAction: 'Approve long-term supply agreement under EPA civil safety exemptions.'
    },
    {
      id: 'epa-v3',
      name: 'SolarWind Offgrids',
      sector: 'Renewable Power',
      category: 'Microgrid Battery Assemblers',
      cyberScore: 72,
      complianceScore: 85,
      operationalScore: 80,
      environmentalScore: 88,
      overallScore: 81,
      status: 'Medium',
      lastAssessment: '2026-05-29',
      recommendedAction: 'Request carbon offsets lifecycle reporting and trace battery disposal logs.'
    }
  ]
};

// Mock frameworks mapping helper
const FRAMEWORK_MAP = [
  { id: 'nist_csf', name: 'NIST CSF', areas: ['Identity (ID.AM)', 'Protect (PR.AC)', 'Detect (DE.CM)', 'Respond (RS.RP)'] },
  { id: 'nist_800_53', name: 'NIST 800-53', areas: ['AC (Access Control)', 'IA (Identification & Auth)', 'SA (System & Services)', 'SC (System & Comm)'] },
  { id: 'iso_27001', name: 'ISO 27001', areas: ['A.5 Security Policies', 'A.9 Access Control', 'A.12 Operations', 'A.15 Supplier Relations'] },
  { id: 'soc_2', name: 'SOC 2 Type II', areas: ['Security Trust Service', 'Availability Trust Service', 'Confidentiality Trust Service'] },
  { id: 'cisa_scrm', name: 'CISA SCRM Guidelines', areas: ['Sovereignty Audit', 'Subtier Vendor Mapping', 'Malicious Code Signing Verification'] },
  { id: 'fedramp', name: 'FedRAMP High Readiness', areas: ['FIPS 140-3 Cryptography', 'Continuous Telemetry Scanning', 'US Citizen Personnel Review'] },
  { id: 'gdpr', name: 'GDPR / Privacy Laws', areas: ['Article 32 Technical Measures', 'EU/US Data Sovereignty Transfer', 'Breach Mitigation Logs'] },
  { id: 'env_epa', name: 'EPA Clean Water / Air', areas: ['Effluent Monitoring telemetry', 'Disposal Authorization Certs', 'Hazardous Spill Containment Plans'] }
];

export function GovIntelSuite() {
  const { demoMode, setDemoMode, getAgencyName } = useDemo();
  const [activeTab, setActiveTab] = useState<'flow' | 'vendors' | 'assessment' | 'grant' | 'evidence' | 'trust'>('flow');
  const [demoStep, setDemoStep] = useState<number>(1);
  const [selectedVendor, setSelectedVendor] = useState<any>(MOCK_SECTOR_VENDORS[demoMode][0]);

  // Form states for Assessment Generator
  const [vendorName, setVendorName] = useState('Infratech Controls');
  const [vendorType, setVendorType] = useState('Software integration partner');
  const [sector, setSector] = useState('Critical Infrastructure Support');
  const [country, setCountry] = useState('Switzerland');
  const [services, setServices] = useState('Remote system monitoring and telemetry relays');
  const [frameworks, setFrameworks] = useState('NIST 800-53, FedRAMP, CISA SCRM');
  const [incidents, setIncidents] = useState('Minor configuration exposure reported in Q1 2026');

  // API Call states
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);

  const [isGeneratingGrant, setIsGeneratingGrant] = useState(false);
  const [grantResult, setGrantResult] = useState<any>(null);

  const [copiedText, setCopiedText] = useState(false);

  // Evidence locker state
  const [uploadedDocs, setUploadedDocs] = useState<Array<any>>([
    { id: 'doc-1', name: 'Sovereignty_Attestation.pdf', type: 'Sovereignty Statement', vendor: selectedVendor.name, framework: 'CISA SCRM', status: 'VERIFIED', expDate: '2027-02-15', reviewer: 'Guardentra Automated Sentinel', summary: 'Attests that zero data storage endpoints or routing protocols route through foreign high-risk jurisdictions.' },
    { id: 'doc-2', name: 'NIST_800_53_Control_Verification.xlsx', type: 'Framework Compliance Matrix', vendor: selectedVendor.name, framework: 'NIST 800-53', status: 'VERIFIED', expDate: '2026-12-01', reviewer: 'Guardentra Automated Sentinel', summary: 'Auto-scanned baseline configurations matching 14/14 identity authorization controls.' }
  ]);
  const [isMockUploading, setIsMockUploading] = useState(false);

  // Sync selected vendor on demoMode change
  useEffect(() => {
    const defaultVendor = MOCK_SECTOR_VENDORS[demoMode][0];
    setSelectedVendor(defaultVendor);
    setVendorName(defaultVendor.name);
    setSector(defaultVendor.sector);
    setServices(defaultVendor.category);
    setAssessmentResult(null);
  }, [demoMode]);

  const handleCopy = () => {
    const textToCopy = `Guardentra AI Assessment Report for ${selectedVendor.name} (${selectedVendor.sector})
    Overall Trust Score: ${selectedVendor.overallScore}/100 • Verdict: ${selectedVendor.status.toUpperCase()} RISK
    Recommended Action: ${selectedVendor.recommendedAction}
    Data compliance mapped directly into sovereign federal registries.`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Run Real AI Assessment
  const handleRunAIAssessment = async () => {
    setIsAssessing(true);
    setAssessmentResult(null);
    try {
      const response = await fetch('/api/ai/gov-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vendorName,
          vendorType,
          sector,
          country,
          services,
          frameworks,
          incidents,
          agencyMode: demoMode
        })
      });
      const data = await response.json();
      setAssessmentResult(data);
      // Advance step if in guide mode
      if (demoStep === 3) {
        setDemoStep(4);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAssessing(false);
    }
  };

  // Run Real Grant Report
  const handleRunGrantReport = async () => {
    setIsGeneratingGrant(true);
    setGrantResult(null);
    try {
      const response = await fetch('/api/ai/grant-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyMode: demoMode })
      });
      const data = await response.json();
      setGrantResult(data);
      if (demoStep === 5) {
        setDemoStep(6);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingGrant(false);
    }
  };

  const triggerMockUpload = () => {
    setIsMockUploading(true);
    setTimeout(() => {
      const newDoc = {
        id: `doc-${Date.now()}`,
        name: `EPA_Effluent_Telemetry_Compliance_${selectedVendor.name}.pdf`,
        type: 'EPA Environmental Compliance Proof',
        vendor: selectedVendor.name,
        framework: 'EPA Clean Water / Air',
        status: 'VERIFIED',
        expDate: '2027-05-29',
        reviewer: 'Admin Inspector',
        summary: 'Attestation of zero regulatory non-disclosures reported under the Civil Water telemetric threshold rules.'
      };
      setUploadedDocs(prev => [newDoc, ...prev]);
      setIsMockUploading(false);
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Header with Agency Mode Selector */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 px-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold tracking-widest uppercase">
              Federal Demonstration Suite v2.0
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display flex items-center gap-2 text-glow">
            <Shield className="h-8 w-8 text-indigo-400" />
            Federal & Client Sector Intelligence
          </h1>
          <p className="text-slate-400 mt-1 max-w-xl text-sm leading-relaxed">
            Demo-ready modules engineered specifically for Department of Homeland Security, Commerce, and EPA grant reviews.
          </p>
        </div>

        {/* Agency Demo Selector */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <span className="text-slate-500 text-xs font-mono font-bold tracking-wider self-center uppercase hidden md:inline">
            Active Agency Core:
          </span>
          <div className="grid grid-cols-3 gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
            <Button
              onClick={() => setDemoMode('dhs')}
              className={cn(
                "h-10 text-xs font-bold tracking-wide transition-all",
                demoMode === 'dhs' 
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20" 
                  : "bg-transparent text-slate-400 hover:text-white"
              )}
            >
              DHS Mode
            </Button>
            <Button
              onClick={() => setDemoMode('commerce')}
              className={cn(
                "h-10 text-xs font-bold tracking-wide transition-all",
                demoMode === 'commerce' 
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20" 
                  : "bg-transparent text-slate-400 hover:text-white"
              )}
            >
              Commerce
            </Button>
            <Button
              onClick={() => setDemoMode('epa')}
              className={cn(
                "h-10 text-xs font-bold tracking-wide transition-all",
                demoMode === 'epa' 
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20" 
                  : "bg-transparent text-slate-400 hover:text-white"
              )}
            >
              EPA Mode
            </Button>
          </div>
        </div>
      </div>

      {/* Mode Status Callout */}
      <div className="relative overflow-hidden glass-panel p-5 rounded-2xl border-indigo-500/10 bg-indigo-500/[0.02]">
        <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12 scale-150">
          <Sparkles className="h-24 w-24" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-500/15 rounded-xl border border-indigo-500/20 mt-1 shrink-0">
              <Zap className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                {demoMode === 'dhs' ? 'DHS Control Profile Enabled' :
                 demoMode === 'commerce' ? 'Commerce Resilience Profile Enabled' :
                 'EPA Environmental Compliance Profile Enabled'}
              </h2>
              <p className="text-slate-400 text-sm mt-0.5 leading-relaxed">
                {demoMode === 'dhs' ? 'Synthesizing critical infrastructure supply chain risks, CISA directives, and NIST 800-53 matrix overlays.' :
                 demoMode === 'commerce' ? 'Synthesizing economic supplier redundancies, single point-of-failure vulnerabilities, and industrial trade policies.' :
                 'Synthesizing wastewater systems, hazardous materials, effluent tracking compliance, and EPA sustainability audit readiness.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Guided Suite Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar of the Demo Suite */}
        <div className="space-y-3 lg:col-span-1">
          <Button
            onClick={() => setActiveTab('flow')}
            className={cn(
              "w-full justify-start h-12 text-sm font-bold tracking-wide transition-all rounded-xl border",
              activeTab === 'flow'
                ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-200"
                : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            )}
          >
            <Clock className="h-4 w-4 mr-3" />
            1. Master Demo Flow
            {demoStep < 6 && <span className="ml-auto flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />}
          </Button>

          <Button
            onClick={() => setActiveTab('vendors')}
            className={cn(
              "w-full justify-start h-12 text-sm font-bold tracking-wide transition-all rounded-xl border",
              activeTab === 'vendors'
                ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-200"
                : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            )}
          >
            <Building2 className="h-4 w-4 mr-3" />
            2. Vendor Risk Register
          </Button>

          <Button
            onClick={() => setActiveTab('assessment')}
            className={cn(
              "w-full justify-start h-12 text-sm font-bold tracking-wide transition-all rounded-xl border",
              activeTab === 'assessment'
                ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-200"
                : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            )}
          >
            <Sparkles className="h-4 w-4 mr-3" />
            3. AI Assessment Lab
          </Button>

          <Button
            onClick={() => setActiveTab('trust')}
            className={cn(
              "w-full justify-start h-12 text-sm font-bold tracking-wide transition-all rounded-xl border",
              activeTab === 'trust'
                ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-200"
                : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            )}
          >
            <TrendingUp className="h-4 w-4 mr-3" />
            4. Trust Index Analytics
          </Button>

          <Button
            onClick={() => setActiveTab('grant')}
            className={cn(
              "w-full justify-start h-12 text-sm font-bold tracking-wide transition-all rounded-xl border",
              activeTab === 'grant'
                ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-200"
                : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            )}
          >
            <FileText className="h-4 w-4 mr-3" />
            5. Grant Alignment Report
          </Button>

          <Button
            onClick={() => setActiveTab('evidence')}
            className={cn(
              "w-full justify-start h-12 text-sm font-bold tracking-wide transition-all rounded-xl border",
              activeTab === 'evidence'
                ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-200"
                : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            )}
          >
            <UploadCloud className="h-4 w-4 mr-3" />
            6. Evidence Locker UI
          </Button>

          {/* Core Trust Message Widget */}
          <div className="glass-panel p-4 rounded-xl border-white/5 text-left mt-6">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Lock className="h-3 w-3 text-emerald-400" />
              Sovereign trust statement
            </p>
            <ul className="text-[11px] text-slate-400 space-y-1">
              <li>• Data Minimization active</li>
              <li>• US Data Residency Enforced</li>
              <li>• AI Non-Training Assurance</li>
              <li>• Zero-exposure API proxying</li>
            </ul>
          </div>
        </div>

        {/* View Dashboard Pane */}
        <div className="lg:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: MASTER DEMO FLOW */}
            {activeTab === 'flow' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="glass-panel p-6 rounded-2xl border-white/5 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2 font-display">
                      5-Minute Guided Buyer Demo Walkthrough
                    </h2>
                    <p className="text-xs text-slate-400">
                      Step-by-step instructions to demonstrate Guardentra’s federal capabilities seamlessly.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Guided Steps Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        demoStep === 1 ? "bg-indigo-500/10 border-indigo-500/40 shadow-glow" : "bg-white/5 border-white/5 bg-slate-900/10"
                      )} onClick={() => { setDemoStep(1); setActiveTab('flow'); }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                          <span className="text-xs font-bold text-white uppercase font-mono">Agency Profile Target</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Click <strong>DHS, Commerce, or EPA Mode</strong> at the top right header to instantly rebrand local wording, samples, metrics, and templates.
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        demoStep === 2 ? "bg-indigo-500/10 border-indigo-500/40 shadow-glow" : "bg-white/5 border-white/5 bg-slate-900/10"
                      )} onClick={() => { setDemoStep(2); setActiveTab('vendors'); }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                          <span className="text-xs font-bold text-white uppercase font-mono">Review Vendor Command</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Navigate to <strong>Vendor Risk Register</strong> tab. Observe localized indicators (Cyber, Compliance, Environmental scores) customized exactly to agency expectations.
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        demoStep === 3 ? "bg-indigo-500/10 border-indigo-500/40 shadow-glow" : "bg-white/5 border-white/5 bg-slate-900/10"
                      )} onClick={() => { setDemoStep(3); setActiveTab('assessment'); }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                          <span className="text-xs font-bold text-white uppercase font-mono">Simulate AI Assessment</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Open <strong>AI Assessment Lab</strong>, click <strong>"Execute Intelligent Assessment Engine"</strong> to observe server-directed structured output processing in real-time.
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        demoStep === 4 ? "bg-indigo-500/10 border-indigo-500/40 shadow-glow" : "bg-white/5 border-white/5 bg-slate-900/10"
                      )} onClick={() => { setDemoStep(4); setActiveTab('trust'); }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">4</span>
                          <span className="text-xs font-bold text-white uppercase font-mono">Audit score breakdown</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Open <strong>Trust Index Analytics</strong>. Dive deep into the score structure to see cybersecurity, operational, compliance, environmental factors, and missing attestation weightings.
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        demoStep === 5 ? "bg-indigo-500/10 border-indigo-500/40 shadow-glow" : "bg-white/5 border-white/5 bg-slate-900/10"
                      )} onClick={() => { setDemoStep(5); setActiveTab('grant'); }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">5</span>
                          <span className="text-xs font-bold text-white uppercase font-mono">Compile Grant Alignment</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Generate the <strong>Grant Alignment Report</strong> to show compliance with Federal directives, pilot pipelines, and sovereign data controls.
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        demoStep === 6 ? "bg-indigo-500/10 border-indigo-500/40 shadow-glow" : "bg-white/5 border-white/5 bg-slate-900/10"
                      )} onClick={() => { setDemoStep(6); }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">6</span>
                          <span className="text-xs font-bold text-white uppercase font-mono">Export and Showcase</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Showcase <strong>Evidence Locker uploading</strong> and copy the final telemetry summaries directly for procurement reviews.
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* Actions / Flow Navigation */}
                  <div className="flex justify-end pt-4 border-t border-white/5">
                    <Button 
                      className="bg-indigo-600 hover:bg-indigo-500 text-white"
                      onClick={() => {
                        if (demoStep === 1) { setActiveTab('vendors'); setDemoStep(2); }
                        else if (demoStep === 2) { setActiveTab('assessment'); setDemoStep(3); }
                        else if (demoStep === 3) { handleRunAIAssessment(); }
                        else if (demoStep === 4) { setActiveTab('trust'); setDemoStep(5); }
                        else if (demoStep === 5) { handleRunGrantReport(); }
                        else if (demoStep === 6) { setActiveTab('flow'); setDemoStep(1); }
                      }}
                    >
                      {demoStep === 3 ? "Process Step 3: Run Assessment" :
                       demoStep === 5 ? "Process Step 5: Run Grant PDF" :
                       "Continue to Next Step"}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: VENDOR RISK REGISTER */}
            {activeTab === 'vendors' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="glass-panel p-6 rounded-2xl border-white/5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white font-display">
                        {getAgencyName()} Supply Chain Vendor Dashboard
                      </h3>
                      <p className="text-xs text-slate-400">
                        Operational register listing verified suppliers mapped against agency compliance mandates.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-white/5 text-slate-400 uppercase font-mono font-bold border-b border-white/5">
                        <tr>
                          <th className="p-3">Vendor / Sector</th>
                          <th className="p-3">Cyber</th>
                          <th className="p-3">Compliance</th>
                          <th className="p-3">Operational</th>
                          <th className="p-3">Environmental</th>
                          <th className="p-3">Trust Score</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {MOCK_SECTOR_VENDORS[demoMode].map((vendor) => (
                          <tr key={vendor.id} className={cn(
                            "hover:bg-white/[0.02] transition-all cursor-pointer",
                            selectedVendor.id === vendor.id ? "bg-indigo-600/10" : ""
                          )} onClick={() => {
                            setSelectedVendor(vendor);
                            setVendorName(vendor.name);
                            setSector(vendor.sector);
                          }}>
                            <td className="p-3 font-semibold text-white">
                              <div>{vendor.name}</div>
                              <div className="text-[10px] text-slate-500 font-normal mt-0.5">{vendor.sector}</div>
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-200">{vendor.cyberScore}%</td>
                            <td className="p-3 font-mono font-bold text-slate-200">{vendor.complianceScore}%</td>
                            <td className="p-3 font-mono font-bold text-slate-200">{vendor.operationalScore}%</td>
                            <td className="p-3 font-mono font-bold text-slate-200">{vendor.environmentalScore}%</td>
                            <td className="p-3 font-mono font-bold text-indigo-400">{vendor.overallScore}/100</td>
                            <td className="p-3">
                              <Badge variant="outline" className={cn(
                                "text-[10px] uppercase font-bold",
                                vendor.status === 'Critical' ? "border-rose-500/40 text-rose-400 bg-rose-500/10 shadow-sm" :
                                vendor.status === 'Medium' ? "border-amber-500/40 text-amber-400 bg-amber-500/10" :
                                "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              )}>
                                {vendor.status} Risk
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Button variant="ghost" size="sm" className="h-8 text-[11px] text-indigo-400 hover:text-white" onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVendor(vendor);
                                setActiveTab('assessment');
                              }}>
                                Run AI Analysis
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Selected Vendor Summary Banner */}
                  {selectedVendor && (
                    <div className="mt-8 p-5 rounded-xl border border-white/5 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="p-0.5 px-2 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold rounded-md">
                            Selected Registry Partner
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white">{selectedVendor.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          <strong>Verdict:</strong> {selectedVendor.recommendedAction}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          className="border-white/10 text-slate-300 hover:bg-white/5 h-10 text-xs"
                          onClick={() => {
                            setActiveTab('assessment');
                            // Setup input form
                            setVendorName(selectedVendor.name);
                            setSector(selectedVendor.sector);
                            setServices(selectedVendor.category);
                          }}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Assess Lab
                        </Button>
                        <Button 
                          className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 text-xs"
                          onClick={() => setActiveTab('trust')}
                        >
                          <TrendingUp className="h-4 w-4 mr-2" />
                          View Factors
                        </Button>
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* TAB 3: AI ASSESSMENT LAB */}
            {activeTab === 'assessment' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  
                  {/* Assessment Generator Input Panel */}
                  <Card className="bg-slate-950 border-white/5">
                    <CardHeader>
                      <CardTitle className="text-base text-white">AI Intel Assessment Generator</CardTitle>
                      <CardDescription className="text-xs text-slate-400">
                        Input the vendor specifications below. Guardentra’s telemetry server will query Gemini 3.5 to render real-time audit matrices.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor Name</label>
                          <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sector Sector</label>
                          <Input value={sector} onChange={(e) => setSector(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-xs" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor Type</label>
                          <Input value={vendorType} onChange={(e) => setVendorType(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sovereign Origin (Country)</label>
                          <Input value={country} onChange={(e) => setCountry(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-xs" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Services Provided</label>
                        <Input value={services} onChange={(e) => setServices(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-xs" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Compliance Frameworks</label>
                          <Input value={frameworks} onChange={(e) => setFrameworks(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Prior Incidents / Alerts</label>
                          <Input value={incidents} onChange={(e) => setIncidents(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-xs" />
                        </div>
                      </div>

                      <Button 
                        onClick={handleRunAIAssessment} 
                        disabled={isAssessing}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11"
                      >
                        {isAssessing ? (
                          <>
                            <RotateCw className="h-4 w-4 animate-spin mr-2" />
                            Executing Intelligent Assessment Engine...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Run AI Vendor Risk Assessment
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Assessment Generator Output Panel */}
                  <div className="flex flex-col h-full justify-between">
                    <Card className="bg-slate-950 border-white/5 flex-1 flex flex-col">
                      <CardHeader className="border-b border-white/5 pb-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base text-white flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-400" />
                            Risk Intelligence Scorecard
                          </CardTitle>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-mono border-indigo-500/20 text-indigo-400 bg-indigo-500/5">
                            SECURE TELEMETRY
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-slate-500">
                          Automated assessment verdict securely generated by Guardentra.
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="flex-1 overflow-y-auto max-h-[420px] p-6 space-y-6 custom-scrollbar text-xs">
                        {isAssessing ? (
                          <div className="py-24 flex flex-col items-center justify-center text-slate-500 space-y-3">
                            <RotateCw className="h-10 w-10 text-indigo-400 animate-spin" />
                            <p className="font-mono text-[11px] animate-pulse">Communicating with Guardentra secure cluster...</p>
                          </div>
                        ) : assessmentResult ? (
                          <div className="space-y-6">
                            {/* Summary callout */}
                            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-1.5">
                              <span className="text-[9px] uppercase font-bold text-indigo-400 tracking-widest font-mono">RISK POSTURE BRIEFING</span>
                              <p className="text-slate-300 leading-relaxed font-sans font-medium italic">
                                "{assessmentResult.riskSummary}"
                              </p>
                            </div>

                            {/* Top 5 risks */}
                            <div className="space-y-3">
                              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider font-mono">Top Threat Vectors Mapped</span>
                              <div className="space-y-2">
                                {assessmentResult.topRisks?.map((r: any, idx: number) => (
                                  <div key={idx} className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg flex items-start gap-2.5">
                                    <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="font-bold text-slate-200">{r.risk}</p>
                                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{r.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Suggested mitigations */}
                            <div className="space-y-3.5">
                              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider font-mono">Suggested Tactical Mitigations</span>
                              <ul className="space-y-1.5 text-slate-300">
                                {assessmentResult.mitigations?.map((mit: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>{mit}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Required evidence */}
                            <div className="space-y-2.5">
                              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider font-mono">Evidence Attestation Requests</span>
                              <div className="grid grid-cols-1 gap-2">
                                {assessmentResult.evidenceDocs?.map((doc: string, idx: number) => (
                                  <div key={idx} className="p-2 bg-white/5 border border-white/5 rounded font-mono text-[10px] text-slate-300 flex items-center justify-between">
                                    <span>{doc}</span>
                                    <Badge className="bg-indigo-500 text-white font-mono scale-90">REQUIRED</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Monitoring frequency info */}
                            <div className="p-3 bg-white/5 border border-white/5 rounded-lg flex items-center justify-between">
                              <span className="font-bold text-slate-400">Monitoring Rate:</span>
                              <span className="font-mono text-indigo-400 font-bold">{assessmentResult.monitoringFrequency}</span>
                            </div>

                            {/* Executive Summary */}
                            <p className="text-slate-400 leading-relaxed border-t border-white/5 pt-4 italic">
                              <strong>Executive Summation:</strong> {assessmentResult.executiveSummary}
                            </p>
                          </div>
                        ) : (
                          <div className="py-24 text-center text-slate-500 italic flex flex-col items-center justify-center space-y-3">
                            <Database className="h-12 w-12 text-slate-700 opacity-20" />
                            <p>Intelligent model pipeline idle.</p>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Provide vendor details and click Execute</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                </div>

                {/* Unified Framework Mapping Section underneath */}
                <div className="glass-panel p-6 rounded-2xl border-white/5 space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-indigo-400" />
                      Traceable Compliance Framework Controls Mappings
                    </h4>
                    <p className="text-xs text-slate-400">
                      Cross-reference your vendor metrics against international and federal regulatory specifications.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-4">
                    {FRAMEWORK_MAP.map((f) => {
                      // Simple logic to show EPA active highlight
                      const isEPAActive = demoMode === 'epa' && f.id === 'env_epa';
                      const isDHSActive = demoMode === 'dhs' && (f.id === 'nist_800_53' || f.id === 'cisa_scrm');
                      return (
                        <div key={f.id} className={cn(
                          "p-4 rounded-xl border transition-all",
                          isEPAActive || isDHSActive 
                            ? "bg-indigo-950/40 border-indigo-500/40 shadow-sm" 
                            : "bg-white/5 border-white/5 text-slate-400"
                        )}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-white">{f.name}</span>
                            <Badge variant="outline" className={cn(
                              "text-[8px] uppercase font-bold",
                              isEPAActive || isDHSActive ? "border-indigo-400 text-indigo-400 bg-indigo-500/10" : "border-slate-800 text-slate-500"
                            )}>
                              {isEPAActive || isDHSActive ? 'Sovereign Match' : 'Mappable'}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {f.areas.map((area, idx) => (
                              <div key={idx} className="p-1 px-2 rounded bg-black/20 text-[10px] text-slate-300 font-mono flex items-center justify-between">
                                <span>{area}</span>
                                <Check className="h-3 w-3 text-emerald-400 scale-75" />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </motion.div>
            )}

            {/* TAB 4: TRUST INDEX ANALYTICS */}
            {activeTab === 'trust' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="glass-panel p-6 rounded-2xl border-white/5 space-y-8">
                  <div>
                    <h3 className="text-lg font-bold text-white font-display">
                      Guardentra Score Mechanics breakdown
                    </h3>
                    <p className="text-xs text-slate-400">
                      Deep-dive factor breakdown for {selectedVendor.name}. Understand why their score is scaled.
                    </p>
                  </div>

                  {/* Factor Scoring bars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-5">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Telemetry Core Audit Dimensions</h4>
                      
                      {/* Cybersecurity factor */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-300">Cybersecurity Readiness Controls</span>
                          <span className="font-mono text-indigo-400 font-bold">{selectedVendor.cyberScore}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${selectedVendor.cyberScore}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-500">Weights access keys rotation, TLS protocols, encrypted repositories, and identity configurations.</p>
                      </div>

                      {/* Compliance factor */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-300">Framework Regulatory Alignment</span>
                          <span className="font-mono text-indigo-400 font-bold">{selectedVendor.complianceScore}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${selectedVendor.complianceScore}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-500">Weights SOC 2 coverage, FedRAMP status, NIST alignment, and data residency attestations.</p>
                      </div>

                      {/* Operational factor */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-300">SLA and Operational Resiliency</span>
                          <span className="font-mono text-indigo-400 font-bold">{selectedVendor.operationalScore}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${selectedVendor.operationalScore}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-500">Weights recovery speeds, redundancy instances, operational downtime patterns, and breach notices clauses.</p>
                      </div>

                      {/* Environmental factor */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-300">EPA Environmental compliance</span>
                          <span className="font-mono text-indigo-400 font-bold">{selectedVendor.environmentalScore}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${selectedVendor.environmentalScore}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between">
                          <span>Weights carbon footprints, Clean Water Act reports, chemical waste logs.</span>
                          {demoMode === 'epa' && <Badge className="bg-emerald-500 text-white font-mono scale-90">CRITICAL DEMO SCALE</Badge>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Dynamic Hazard & Integrity Modifiers</h4>
                      
                      {/* Missing evidence penalty */}
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-1">
                        <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5 font-mono uppercase">
                          <Bookmark className="h-4 w-4" />
                          Missing Evidence Weighting Penalty: -15%
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Lack of verified, continuously signed "Sovereign Statement Data policy" decreases raw trust score until uploaded to Evidence Locker.
                        </p>
                      </div>

                      {/* Incident Indicator */}
                      <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-1">
                        <p className="text-xs font-bold text-rose-400 flex items-center gap-1.5 font-mono uppercase">
                          <AlertTriangle className="h-4 w-4" />
                          Recent Threat & Incident Indicator
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Zero active high-severity indicators reported during Q2 2026. Prior alert history has been resolved.
                        </p>
                      </div>

                      {/* AI confidence */}
                      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white font-mono uppercase">Guardentra AI Confidence</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Calculated math accuracy metrics</p>
                        </div>
                        <span className="text-2xl font-bold font-mono text-indigo-400 text-glow">98.4%</span>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 5: GRANT ALIGNMENT REPORT */}
            {activeTab === 'grant' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="glass-panel p-6 rounded-2xl border-white/5 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white font-display uppercase tracking-tight">
                        Federal Grant Readiness Room
                      </h3>
                      <p className="text-xs text-slate-400">
                        Map Guardentra’s features against Federal program criteria for Homeland Security, Commerce, or EPA.
                      </p>
                    </div>
                    <Button 
                      onClick={handleRunGrantReport} 
                      disabled={isGeneratingGrant}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6"
                    >
                      {isGeneratingGrant ? (
                        <>
                          <RotateCw className="h-4 w-4 animate-spin mr-2" />
                          Compiling Grant Alignment PDF...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Compile Grant Alignment Report
                        </>
                      )}
                    </Button>
                  </div>

                  <AnimatePresence mode="wait">
                    {isGeneratingGrant ? (
                      <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center space-y-4">
                        <RotateCw className="h-12 w-12 text-indigo-400 animate-spin" />
                        <div>
                          <p className="font-mono text-white text-xs animate-pulse">Running grant strategy models...</p>
                          <p className="text-[10px] text-slate-500 mt-1">Comparing supply pipeline data sets with Federal funding parameters</p>
                        </div>
                      </div>
                    ) : grantResult ? (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="space-y-6 pt-4 text-xs leading-relaxed"
                      >
                        {/* Copy / Export controls */}
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="border-white/10 text-slate-300" onClick={handleCopy}>
                            {copiedText ? (
                              <><Check className="h-4 w-4 mr-2 text-emerald-400" /> Copied Text!</>
                            ) : (
                              <><Copy className="h-4 w-4 mr-2" /> Copy Summary</>
                            )}
                          </Button>
                        </div>

                        {/* Report Sections Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          <div className="space-y-1.5 p-4 bg-white/5 border border-white/5 rounded-xl">
                            <h4 className="font-bold text-white uppercase tracking-wider font-mono">1. Statement of the Problem</h4>
                            <p className="text-slate-300">{grantResult.problemStatement}</p>
                          </div>

                          <div className="space-y-1.5 p-4 bg-white/5 border border-white/5 rounded-xl">
                            <h4 className="font-bold text-white uppercase tracking-wider font-mono">2. Public Sector Relevance</h4>
                            <p className="text-slate-300">{grantResult.publicSectorRelevance}</p>
                          </div>

                          <div className="space-y-1.5 p-4 bg-white/5 border border-white/5 rounded-xl">
                            <h4 className="font-bold text-white uppercase tracking-wider font-mono">3. Target Federal Users</h4>
                            <p className="text-slate-300">{grantResult.targetUsers}</p>
                          </div>

                          <div className="space-y-1.5 p-4 bg-white/5 border border-white/5 rounded-xl">
                            <h4 className="font-bold text-white uppercase tracking-wider font-mono">4. Core System Capabilities</h4>
                            <p className="text-slate-300">{grantResult.coreCapabilities}</p>
                          </div>

                          <div className="space-y-1.5 p-4 bg-white/5 border border-white/5 rounded-xl">
                            <h4 className="font-bold text-white uppercase tracking-wider font-mono">5. Measurable expected Impact</h4>
                            <p className="text-slate-300">{grantResult.expectedImpact}</p>
                          </div>

                          <div className="space-y-1.5 p-4 bg-white/5 border border-white/5 rounded-xl">
                            <h4 className="font-bold text-white uppercase tracking-wider font-mono">6. Public Pilot Use Case</h4>
                            <p className="text-slate-300">{grantResult.pilotUseCase}</p>
                          </div>

                          <div className="space-y-1.5 p-4 bg-white/5 border border-white/5 rounded-xl">
                            <h4 className="font-bold text-white uppercase tracking-wider font-mono">7. Data Privacy Security</h4>
                            <p className="text-slate-300">{grantResult.privacySecurity}</p>
                          </div>

                          <div className="space-y-1.5 p-4 bg-white/5 border border-white/5 rounded-xl">
                            <h4 className="font-bold text-white uppercase tracking-wider font-mono">8. Suggested Next Steps</h4>
                            <p className="text-slate-300">{grantResult.nextSteps}</p>
                          </div>

                        </div>
                      </motion.div>
                    ) : (
                      <div className="py-20 text-center text-slate-500 italic flex flex-col items-center justify-center space-y-3">
                        <FileCheck className="h-12 w-12 text-slate-800 opacity-20" />
                        <p>No alignment report compiled yet.</p>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Click compile above to query regulatory directives</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* TAB 6: EVIDENCE LOCKER */}
            {activeTab === 'evidence' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="glass-panel p-6 rounded-2xl border-white/5 space-y-6">
                  
                  {/* File upload prompt */}
                  <div>
                    <h3 className="text-lg font-bold text-white font-display">
                      Federal Evidence Attestation Locker
                    </h3>
                    <p className="text-xs text-slate-400">
                      Submit and verify compliance attestation records directly. Scanned by Guardentra Automated Sentinels.
                    </p>
                  </div>

                  {/* Drag and Drop selector */}
                  <div 
                    onClick={triggerMockUpload}
                    className="p-10 border border-dashed border-white/10 rounded-2xl bg-white/[0.01] flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.03] transition-all group"
                  >
                    {isMockUploading ? (
                      <div className="space-y-3">
                        <RotateCw className="h-8 w-8 text-indigo-400 animate-spin mx-auto animate-bounce" />
                        <p className="text-xs font-mono font-bold text-white animate-pulse">AUTOMATED AI CRYPTOGRAPHIC PARSING ACTIVE...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 bg-white/5 rounded-full inline-block group-hover:scale-105 transition-transform border border-white/10">
                          <UploadCloud className="h-6 w-6 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Drag and drop attestation files here, or click to open computer storage</p>
                          <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase">Supports PDF, XLSX up to 50MB • Mapped instantly into AI Trust weights</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Uploaded Documents List */}
                  <div className="space-y-4">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest font-mono">Verified Attestations History</span>
                    <div className="space-y-3">
                      {uploadedDocs.map((doc) => (
                        <div key={doc.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs transition-hover hover:border-white/20">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{doc.name}</span>
                              <span className="p-0.5 px-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded">
                                {doc.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed font-sans italic">
                              <strong>AI Attestation Summary:</strong> "{doc.summary}"
                            </p>
                            <p className="text-[10px] text-slate-500 flex gap-4 font-mono">
                              <span><strong>Vendor:</strong> {doc.vendor}</span>
                              <span><strong>Control:</strong> {doc.framework}</span>
                              <span><strong>Reviewer:</strong> {doc.reviewer}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-slate-500 block font-mono">EXPIRATION</span>
                            <span className="font-mono text-rose-400 font-bold">{doc.expDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
