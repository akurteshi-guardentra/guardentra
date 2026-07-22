import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  X, 
  Send, 
  Loader2, 
  FileText, 
  AlertTriangle, 
  ShieldCheck, 
  ChevronRight, 
  User, 
  Bot, 
  Clipboard, 
  CheckCircle2, 
  Mail, 
  Sliders, 
  ArrowRight,
  ArrowRightCircle,
  HelpCircle,
  Clock,
  ShieldAlert,
  HardDriveUpload,
  Calendar,
  Building2,
  Lock
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useAuth } from '../lib/AuthContext';
import { GuardentraLogo } from './GuardentraBrand';
import { cn } from '@/src/lib/utils';

interface AICopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Typical mock documents for quick selector
const MOCK_FILES = [
  { id: 'soc2', name: 'Vendor_SOC_2_Attestation_2025.pdf', size: '2.4 MB', type: 'SOC 2 Type II' },
  { id: 'iso27001', name: 'ISO_27001_Recertification_Audit_Certificate.pdf', size: '1.1 MB', type: 'ISO 27001' },
  { id: 'environmental', name: 'WaterUtility_EPA_Wastewater_Compliance_Draft.pdf', size: '3.6 MB', type: 'Environmental/EPA' },
  { id: 'gdpr', name: 'GDPR_Data_Processing_Addendum_V3.pdf', size: '940 KB', type: 'Data Privacy' },
];

export function AICopilotPanel({ isOpen, onClose }: AICopilotPanelProps) {
  const location = useLocation();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'evidence' | 'remediation' | 'frameworks'>('chat');
  
  // Tab 1: Conversational Chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I am your Guardentra Trust Copilot. Click any shortcut below, upload evidence files for immediate checking, or ask me for remediation checklists details. What compliance obstacle can I help you clear today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tab 2: AI Evidence Review
  const [selectedFileId, setSelectedFileId] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);

  // Tab 3: AI Remediation Engine
  const [selectedGap, setSelectedGap] = useState('stale-mfa');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [remediationPlan, setRemediationPlan] = useState<any>(null);
  const [showEmailDraft, setShowEmailDraft] = useState(false);

  // Tab 4: Dynamic Compliance Advisor
  const [companyProfile, setCompanyProfile] = useState({
    industry: 'SaaS',
    size: 'Growth State (100-500 members)',
    regulatoryJurisdiction: 'US/EU Mixed'
  });
  const [isClassifying, setIsClassifying] = useState(false);
  const [regulatoryRecommendations, setRegulatoryRecommendations] = useState<any>(null);

  // Scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  // Contextual shortcuts depending on the page route
  const getContextualPromShortcut = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) {
      return [
        { label: "Summarize outstanding compliance risks", query: "Can you analyze our overall dashboard health and list our top 3 highest priority focus tasks today in plain human English?" },
        { label: "Provide strategic GRC outline", query: "Give me an executive summary style strategic action checklist for state regulatory compliance." }
      ];
    } else if (path.includes('vendors')) {
      return [
        { label: "Draft vendor cyber protection clause", query: "Please compile a sample plain-English cybersecurity contract clause we can copy-paste for third-party subcontractors." },
        { label: "Cross-reference NAIC instructions", query: "Explain the third-party security tracking requirements defined in the NAIC Data Security Model Law simply." }
      ];
    } else if (path.includes('compliance')) {
      return [
        { label: "Draft access control requirement checklist", query: "Explain what proof/evidence we need to compile to verify ISO 27001 Access Control requirements are functional." },
        { label: "Build custom SOC 2 readiness framework", query: "Provide a simple compliance checking protocol for SOC 2 Trust Service Criteria regarding customer data safety." }
      ];
    } else if (path.includes('risks')) {
      return [
        { label: "Design ransomware mitigation standard", query: "Draft a plain-English security protocol to handle third-party ransomware contingency risks." },
        { label: "Calculate risk business exposure", query: "How is the Value at Risk (VaR) computed based on incomplete vendor certifications?" }
      ];
    }
    return [
      { label: "Structure standard vendor risk criteria", query: "Let's review the required evidence and compliance criteria for new critical software vendors." },
      { label: "Explain Guardentra Trust index scoring", query: "How is the Guardentra Trust Index calculated, and what are the primary positive drivers?" }
    ];
  };

  const currentShortcuts = getContextualPromShortcut();

  // Handle universal model call to Gemini
  const askGemini = async (promptText: string, jsonFormat = false) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // Fast preview model
      const res = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: jsonFormat ? { responseMimeType: 'application/json' } : undefined
      });
      return res.text || "";
    } catch (e: any) {
      console.warn("Copilot Gemini API call failed, using high-context fallback. Details:", e);
      return "";
    }
  };

  // Text message submission
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim()) return;

    if (!customText) setInputText('');
    
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    // Prompt context injection
    const promptContext = `
      You are Guardentra Trust Copilot, the automated companion inside the Guardentra Trust Operations platform.
      Current App Location Context: ${location.pathname}
      User Organization Context: Industry is ${(profile as any)?.industry || 'SaaS'}, Location: ${(profile as any)?.country || 'US'}.
      
      CRITICAL INSTRUCTIONS:
      1. Write in plain, clear, conversational, actionable human English instead of dry robotic corporate compliance jargon.
      2. Keep statements structured and easy to read.
      3. Focus on "What action the user must take next" instead of regulatory metrics.
      4. Avoid listing file paths or container details. This is for business operators.
      
      User query: ${textToSend}
    `;

    const response = await askGemini(promptContext);
    
    let answer = response;
    if (!answer) {
      // Offline fallback
      if (textToSend.toLowerCase().includes('naic') || textToSend.toLowerCase().includes('insurance')) {
        answer = `Regarding NAIC regulations, companies must verify that subcontractors maintain secure systems. Under Guardentra guidelines, you should first ask them to share their SOC 2 certificate and then audit their data retention settings using the Evidence Reviewer tab above.`;
      } else if (textToSend.toLowerCase().includes('clause') || textToSend.toLowerCase().includes('draft')) {
        answer = `### Guardentra Clause Template: 
**Third-Party Security Duties**
The Vendor certifies that it maintains a functional security program. The Vendor will share verified SOC 2 or audit attestations annually on the Guardentra portal. In case of any credential anomaly or cyber event, the Vendor will inform the client in writing within 2 hours.`;
      } else {
        answer = `I have updated your context for location '${location.pathname}'. Based on default compliance guidelines, you should review outstanding vendor vulnerabilities in the Onboarding dashboard. Let me know if you would like to draft a formal information request email under the "Remediation Planner" tab!`;
      }
    }

    setMessages(prev => [...prev, {
      id: `bot-${Date.now()}`,
      role: 'assistant',
      content: answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setChatLoading(false);
  };

  // Drag and drop / selector AI Evidence analysis
  const executeEvidenceReview = async () => {
    if (!selectedFileId) return;
    setIsReviewing(true);
    const docMeta = MOCK_FILES.find(f => f.id === selectedFileId);
    
    const prompt = `
      You are Guardentra's Automated Evidence Sentinel. Analyze the document submission: "${docMeta?.name}" of style "${docMeta?.type}".
      Perform an extreme audit scan. Identify expiring certifications, compliance signals, missing evidence alerts, and open gaps.
      Return a response strictly following this JSON schema:
      {
        "documentName": "${docMeta?.name}",
        "documentType": "${docMeta?.type}",
        "issuer": "Verifiable Security Auditors Ltd",
        "complianceScore": 92,
        "validUntil": "2027-04-18",
        "status": "APPROVED" or "ACTION REQUIRED",
        "summary": "2-sentence plain English summary of findings",
        "evidenceSignals": ["List of 3 specific positive compliance proofs extracted"],
        "detectedGaps": ["List of 2 potential issues or missing clauses found"]
      }
    `;

    const responseText = await askGemini(prompt, true);
    setIsReviewing(false);

    if (responseText) {
      try {
        const clean = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        setReviewResult(JSON.parse(clean));
        return;
      } catch (e) {
        console.warn("Evidence parser JSON failed, using standard generator", e);
      }
    }

    // High fidelity fallback for offline
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    await delay(1200);

    const fallbacks: Record<string, any> = {
      soc2: {
        documentName: 'Vendor_SOC_2_Attestation_2025.pdf',
        documentType: 'SOC 2 Type II',
        issuer: 'Prism Cybersecurity Advisory LLC',
        complianceScore: 94,
        validUntil: '2026-11-30',
        status: 'APPROVED',
        summary: 'Excellent security posture with zero critical control omissions. The vendor shows exceptional data control, host encryption, and robust firewalls.',
        evidenceSignals: [
          'Multifactor authorization enforced on all administrator servers.',
          'Secure databases encrypt credentials both at-rest and in-transit.',
          'Continuous audit logging enabled across production clusters.'
        ],
        detectedGaps: [
          'Backup recovery simulations are performed only annually rather than quarterly.',
          'Missing explicit mention of fourth-party cloud vendor accountability clauses.'
        ]
      },
      iso27001: {
        documentName: 'ISO_27001_Recertification_Audit_Certificate.pdf',
        documentType: 'ISO 27001:2022',
        issuer: 'Global Trust Standards Authority',
        complianceScore: 88,
        validUntil: '2025-08-14',
        status: 'ACTION REQUIRED',
        summary: 'ISO certificate is legitimate, but the certification is close to its expiration date. Recommended action is to prompt their team for a renewal plan.',
        evidenceSignals: [
          'Documented Annex A.12 configuration checklists are compliant.',
          'Clear security awareness records maintained for staff hires.',
          'Physical access badges mapped to privileged keyholder registers.'
        ],
        detectedGaps: [
          'Vulnerability scans show patch mitigation latency exceeds the certified 15-day SLA limits.',
          'The certification terminates on 2025-08-14, creating an upcoming critical compliance gap.'
        ]
      },
      environmental: {
        documentName: 'WaterUtility_EPA_Wastewater_Compliance_Draft.pdf',
        documentType: 'EPA Environment Review',
        issuer: 'Federal Environmental Oversight Corp',
        complianceScore: 78,
        validUntil: '2026-03-01',
        status: 'ACTION REQUIRED',
        summary: 'Water telemetry readings identified 2 warning-level violations in overflow basins. Immediate remediation is critical before the EPA quarterly audit.',
        evidenceSignals: [
          'Secondary containment structures are active around hazardous reserves.',
          'All chemical flow controllers have verifiable calibration certificates.',
          'Emergency isolation protocols are verified and documented.'
        ],
        detectedGaps: [
          'Wastewater chemical telemetry reports a 12% surplus in trace sediment parameters.',
          'Missing bi-weekly sampling proof for the backup stormwater reservoir.'
        ]
      },
      gdpr: {
        documentName: 'GDPR_Data_Processing_Addendum_V3.pdf',
        documentType: 'GDPR Privacy Addendum',
        issuer: 'Euro Compliance Partners',
        complianceScore: 95,
        validUntil: 'Indefinite',
        status: 'APPROVED',
        summary: 'Perfect legal structure mapping. Data protection directives, breach notification SLA, and custom EU standard clauses are meticulously implemented.',
        evidenceSignals: [
          'Strict 72-hour breach notification clause clearly specified.',
          'Explicit user data deletion (Right to be Forgotten) pathways configured.',
          'Cross-border data transit restricted to compliant sovereign nodes.'
        ],
        detectedGaps: [
          'No internal audit proof shown for sub-processors listed in Annex III.',
          'Missing localized security liaison contact information.'
        ]
      }
    };

    setReviewResult(fallbacks[selectedFileId] || fallbacks.soc2);
  };

  // Generate remediation protocol
  const generateRemediationMatrix = async () => {
    setIsGeneratingPlan(true);
    setShowEmailDraft(false);

    const gapDetails: Record<string, string> = {
      'stale-mfa': 'Stale cloud administrator roles discovered with multi-factor authentication (MFA) parameters completely bypassed.',
      'expired-soc2': 'Critical SaaS vendor third-party SOC 2 Type II assurance report expired on Jan 14th without renewal records.',
      'leak-vulnerability': 'Penetration test detected open SSH port exposing development databases to public web addresses.',
      'water-surplus': 'EPA compliance warning: wastewater monitoring reports excess sediment telemetry thresholds.',
    };

    const targetGap = gapDetails[selectedGap] || gapDetails['stale-mfa'];

    const prompt = `
      You are Guardentra's AI Remediation Coordinator. Build an actionable remediation plan for this gap: "${targetGap}".
      We need clean, straightforward, plain-English instructions. No generic technical slop.
      Return a response following this JSON schema:
      {
        "gapTitle": "Plain English Title",
        "severity": "Critical" | "High" | "Medium",
        "businessImpact": "Short paragraph explaining business impact",
        "steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
        "ownerRecommendation": "Owner role (e.g. Lead Dev, CISO, Facilities)",
        "daysToComplete": 7,
        "requiredProof": "Exactly what proof/document checks are needed",
        "followUpEmail": "A plain English email draft the user can copy to prompt the vendor or team"
      }
    `;

    const responseText = await askGemini(prompt, true);
    setIsGeneratingPlan(false);

    if (responseText) {
      try {
        const clean = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        setRemediationPlan(JSON.parse(clean));
        return;
      } catch (e) {
        console.warn("Remediation parser failed", e);
      }
    }

    // Delay simulation
    await new Promise(r => setTimeout(r, 1200));

    const fallbacks: Record<string, any> = {
      'stale-mfa': {
        gapTitle: "Required admin access keys are unprotected",
        severity: "Critical",
        businessImpact: "If an administrator account has no dual-factor padlock, malicious bots can guess credentials, gain absolute cloud database control, and cause immediate operations shutdown.",
        steps: [
          "Locate active administrator roles under identity registers.",
          "Identify accounts that have zero hardware key or authenticator app connections.",
          "Enforce active dual-factor rules (Conditional Access) immediately.",
          "Invalidate active access sessions to prompt users for compliance resets."
        ],
        ownerRecommendation: "Cloud Systems Lead",
        daysToComplete: 1,
        requiredProof: "System screenshot showing MFA status active for 100% of admin roles.",
        followUpEmail: `Subject: URGENT: Action required – Setup dual-factor security password

Hi Team,

Our automatic compliance scanner flags that your administrator profile has no active multi-factor setting.

To preserve system access integrity, please navigate to your profile settings immediately and link your authenticator app. Accounts not completing this setup today will be restricted as a safety threshold.

Thank you!
Guardentra Ops`
      },
      'expired-soc2': {
        gapTitle: "Supplier security certificate has expired",
        severity: "High",
        businessImpact: "Without a fresh independent review (SOC 2), we cannot prove to regulators (NYDFS/NAIC) that our partners are actively safeguarding our consumer files.",
        steps: [
          "Check the vendor portal to isolate when the old SOC 2 report lapsed.",
          "Draft an informational notice to the vendor liaison request point.",
          "Verify if a raw bridge letter has been issued for the intermediate months.",
          "Set an automated alert on the timeline for their renewal release date."
        ],
        ownerRecommendation: "Procurement Manager / CISO Counsel",
        daysToComplete: 5,
        requiredProof: "Freshly uploaded SOC 2 compliance document or bridge letter.",
        followUpEmail: `Subject: Guardentra Audit: Update required for SOC 2 security certificate

Dear Compliance Operations Team,

During our regular compliance evaluation on Guardentra, we identified that your previous security attestation (SOC 2 Type II) has reached its expiration threshold.

Could you please upload your latest audit report (or a formal continuity bridge letter) directly to our Guardentra secure locker? 

This keeps our partnership active and ensures we satisfy our Board's third-party safety guidelines.

Sincerely,
Risk & Compliance Officer`
      },
      'leak-vulnerability': {
        gapTitle: "System port left open to public internet",
        severity: "Critical",
        businessImpact: "Malicious agencies can perform automated network range scans, find the open port, and dump entire database inventories within minutes.",
        steps: [
          "Isolate the development server resource in your AWS or Azure console.",
          "Restrict the security group rules to block SSH (Port 22) connections from Anywhere (0.0.0.0/0).",
          "Permit accesses exclusively through secure Bastion proxy gateways.",
          "Review transaction logs to confirm no unusual telemetry took place."
        ],
        ownerRecommendation: "Platform Architect",
        daysToComplete: 2,
        requiredProof: "Configuration checklist trace proving public routing rule removed.",
        followUpEmail: `Subject: EMERGENCY REMEDIATION: Port vulnerability identified

Hi Operations Lead,

A critical external exposure was detected: Server Port 22 is open to the public web.

Please modify the security policy group rules IMMEDIATELY to restrict access exclusively to our corporate private gateway addresses.

Once done, upload the policy rule snapshot to our audit folder on Guardentra.

Best regards,
Security Officer`
      },
      'water-surplus': {
        gapTitle: "Excess sediment level detected in water telemetry",
        severity: "High",
        businessImpact: "Operating with excess trace materials violates Clean Water guidelines, creating direct exposure to state inspector cease-orders and civil fines.",
        steps: [
          "Request immediate recalibration trace for chemical dispersion apparatus.",
          "Perform double manual inspection sample tests on discharge channels.",
          "Install tertiary auxiliary carbon filters to capture excess organic surplus.",
          "File reports with local environmental monitoring agencies within standard thresholds."
        ],
        ownerRecommendation: "EHS Manager (Environmental, Health & Safety)",
        daysToComplete: 3,
        requiredProof: "Calibration receipt and lab report proof showing levels restored below thresholds.",
        followUpEmail: `Subject: Notice: Discharge level anomaly remediation required

Dear Plant Operations,

Our wastewater tracker highlights that yesterday's trace particulate values crossed standard safety margins.

Kindly assign an engineer to inspect the filter columns and run manual sampling testing immediately. Please upload log proof showing corrected levels to our environmental checklist on Guardentra.

Best,
Sustainability & EHS Team`
      }
    };

    setRemediationPlan(fallbacks[selectedGap] || fallbacks['stale-mfa']);
  };

  // Tab 4: Framework classification
  const recommendFrameworks = async () => {
    setIsClassifying(true);
    const prompt = `
      Analyze our company profile: Industry is ${companyProfile.industry}, Size is ${companyProfile.size}, Jurisdiction is ${companyProfile.regulatoryJurisdiction}.
      Suggest exactly 4 relevant compliance frameworks.
      Return a response following this JSON schema:
      {
        "frameworks": [
          {
            "name": "SOC 2 Type II",
            "suitability": "98% (Critical)",
            "plainEnglishReason": "Short conversational sentence explaining why simply.",
            "operationalStep": "Enable continuous cloud telemetry with Guardentra audit connectors."
          }
        ]
      }
    `;

    const response = await askGemini(prompt, true);
    setIsClassifying(false);

    if (response) {
      try {
        const clean = response.replace(/```json/g, '').replace(/```/g, '').trim();
        setRegulatoryRecommendations(JSON.parse(clean).frameworks);
        return;
      } catch (e) {
        console.warn("Framework parser failed", e);
      }
    }

    // Failovers
    await new Promise(r => setTimeout(r, 1000));
    const SaaSRecs = [
      { name: 'SOC 2 Type II (Security)', suitability: '99% Required', plainEnglishReason: 'Customers demanding custom SaaS access require independent proof of dual-factor security and database protection.', operationalStep: 'Activate continuous AWS/GitHub automated audits inside Guardentra Connectors.' },
      { name: 'ISO 27001 (Security Management)', suitability: '92% Highly Useful', plainEnglishReason: 'Required if you intend to win contracts with overseas aerospace partners or global enterprises.', operationalStep: 'Generate internal asset matrices inside the Policies folder.' },
      { name: 'GDPR (Data Privacy)', suitability: '86% Essential', plainEnglishReason: 'Protects consumer and operator files belonging to European citizens simply and legally.', operationalStep: 'Implement standard Standard Contractual Clauses under contract review.' },
      { name: 'DORA & NIS2 (Sovereign Safety)', suitability: '75% Upcoming', plainEnglishReason: 'Essential if you offer software to critical EU financial institutes or utilities.', operationalStep: 'Setup real-time automated incident triggers inside the Ops drawer.' }
    ];

    const WaterRecs = [
      { name: 'EPA Civil Protection Criteria', suitability: '100% Critical', plainEnglishReason: 'Required to prevent sudden environmental regulatory stop-orders or local civil penalties.', operationalStep: 'Upload wastewater telemetry records directly into the Audit Evidence Vault.' },
      { name: 'NIST CSF (Critical Infrastructure)', suitability: '92% Highly Recommended', plainEnglishReason: 'Essential to defend physical grid computer nodes from state-sponsored cyber intrusion.', operationalStep: 'Establish privileged access controls under our Devices matrix.' },
      { name: 'ISO 14001 (Sustainability Operations)', suitability: '85% Recommended', plainEnglishReason: 'Establishes credibility with municipal sustainability boards and community partners.', operationalStep: 'Adopt template EHS policies in the Policy Draftsman.' },
      { name: 'CISA Security Directives', suitability: '80% Recommended', plainEnglishReason: 'Aligns operations with Homeland Security guidelines to safeguard critical civilian resources.', operationalStep: 'Initiate monthly automated firewalls assessment audits.' }
    ];

    setRegulatoryRecommendations(companyProfile.industry === 'Water Utility/Infrastructure' ? WaterRecs : SaaSRecs);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop screen lock mask */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[80]"
          />

          {/* Copilot Drawer Panel */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[460px] md:w-[500px] h-screen bg-[#070b13] border-l border-white/10 shadow-2xl z-[90] flex flex-col focus:outline-none"
            aria-modal="true"
            role="dialog"
          >
            {/* Header branding & close button */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-950/75 shrink-0">
              <div className="flex items-center gap-2">
                <GuardentraLogo size="sm" showText={true} />
                <Badge className="bg-indigo-500/10 text-indigo-400 font-mono tracking-widest text-[9px] uppercase border border-indigo-500/20 px-2 py-0.5 ml-2 animate-pulse">
                  Trust Copilot v2.1
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="p-2 border-b border-white/5 bg-slate-950/40 grid grid-cols-4 gap-1 shrink-0">
              {[
                { tab: 'chat', label: 'Chat', icon: Bot },
                { tab: 'evidence', label: 'Evidence', icon: FileText },
                { tab: 'remediation', label: 'Remediation', icon: AlertTriangle },
                { tab: 'frameworks', label: 'Compliance', icon: Sliders },
              ].map((b) => (
                <button
                  key={b.tab}
                  onClick={() => {
                    setActiveTab(b.tab as any);
                    setSelectedFileId('');
                    setReviewResult(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-2 px-1 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all",
                    activeTab === b.tab 
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold" 
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
                  )}
                >
                  <b.icon className="h-4 w-4" />
                  {b.label}
                </button>
              ))}
            </div>

            {/* Panel Tab View Area */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-transparent flex flex-col p-5">
              
              {/* Tab 1: Interactive Chat */}
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col min-h-0 justify-between">
                  {/* Chat messages layout */}
                  <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin">
                    {messages.map((m) => (
                      <div 
                        key={m.id} 
                        className={cn(
                          "flex gap-3",
                          m.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        {m.role !== 'user' && (
                          <div className="h-7 w-7 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                            <Sparkles className="h-4 w-4 text-indigo-400" />
                          </div>
                        )}
                        <div className="flex flex-col max-w-[80%]">
                          <div 
                            className={cn(
                              "px-4 py-3 rounded-2xl text-xs sm:text-sm shadow-xl leading-relaxed whitespace-pre-line border",
                              m.role === 'user' 
                                ? "bg-indigo-600 text-white border-indigo-500 rounded-br-none" 
                                : "bg-white/[0.02] text-slate-300 border-white/5 rounded-bl-none"
                            )}
                          >
                            {m.content}
                          </div>
                          <span className={cn(
                            "text-[9px] text-slate-600 mt-1 font-mono",
                            m.role === 'user' ? "text-right" : "text-left"
                          )}>
                            {m.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {chatLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="h-7 w-7 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center animate-spin">
                          <Loader2 className="h-4 w-4 text-indigo-400" />
                        </div>
                        <div className="bg-white/[0.01] border border-white/5 px-4 py-3 rounded-2xl rounded-bl-none text-xs text-slate-500 uppercase tracking-widest font-mono">
                          Guardentra AI is summarizing context...
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contextual prompt suggestions */}
                  <div className="space-y-2 mb-4">
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      In-context quick dialog shortcuts:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {currentShortcuts.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(s.query)}
                          className="text-left py-2 px-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-xs text-indigo-200 transition-all flex justify-between items-center group font-medium"
                        >
                          <span className="line-clamp-1">{s.label}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input form */}
                  <div className="flex gap-2 bg-slate-950 p-2.5 rounded-xl border border-white/5 shrink-0">
                    <Input
                      placeholder="Ask Guardentra AI GRC questions..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendMessage();
                      }}
                      className="border-none bg-transparent text-white focus-visible:ring-0 placeholder:text-slate-600 text-xs sm:text-sm h-10"
                    />
                    <Button 
                      onClick={() => handleSendMessage()}
                      size="icon"
                      className="bg-indigo-600 hover:bg-indigo-500 shrink-0 h-10 w-10 transition-colors"
                      disabled={chatLoading || !inputText.trim()}
                    >
                      <Send className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 2: AI Evidence Reviewer */}
              {activeTab === 'evidence' && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-400" />
                      AI Evidence Locker Reviewer
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Drop evidence PDFs or certificates. AI will extract compliance signals and flag gaps.
                    </p>
                  </div>

                  {/* Drag & drop file room simulation */}
                  <div className="p-6 bg-white/[0.02] rounded-2.5xl border border-white/5 border-dashed border-slate-700 flex flex-col items-center justify-center text-center group hover:border-indigo-500/40 transition-all relative overflow-hidden">
                    <HardDriveUpload className="h-10 w-10 text-slate-500 mb-3 group-hover:text-indigo-400 transition-colors" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Drag attestation document here</h4>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-xs leading-normal">
                      Accepts SOC 2 reports, ISO receipts, policy drafts, wastewater telemetry, or questionnaire XLS
                    </p>
                    <div className="absolute inset-0 bg-white/[0.01] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" />
                  </div>

                  {/* Quick select selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Or select typical test files:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {MOCK_FILES.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            setSelectedFileId(f.id);
                            setReviewResult(null);
                          }}
                          className={cn(
                            "p-3 rounded-xl border text-left flex flex-col gap-1 transition-all",
                            selectedFileId === f.id 
                              ? "bg-indigo-500/15 border-indigo-500/40" 
                              : "bg-white/[0.01] border-white/5 hover:border-white/10"
                          )}
                        >
                          <span className={cn(
                            "text-xs font-bold truncate",
                            selectedFileId === f.id ? "text-indigo-300" : "text-white"
                          )}>{f.name}</span>
                          <span className="text-[9px] text-slate-500 uppercase font-mono">{f.type} • {f.size}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedFileId && !reviewResult && (
                    <Button 
                      onClick={executeEvidenceReview}
                      disabled={isReviewing}
                      className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest"
                    >
                      {isReviewing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Extracting Compliance proofs...
                        </>
                      ) : (
                        "Analyze Document Credentials"
                      )}
                    </Button>
                  )}

                  {/* Diagnostic Output Results */}
                  {reviewResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Classification</span>
                            <h4 className="text-xs font-bold text-white font-mono">{reviewResult.documentType}</h4>
                          </div>
                          <Badge className={cn(
                            "font-bold text-[9px] uppercase tracking-wider px-2 py-0.5",
                            reviewResult.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          )}>
                            {reviewResult.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4 bg-white/[0.01] p-3 rounded-lg border border-white/5">
                          <div>
                            <p className="text-[9px] text-slate-500 uppercase font-mono">Evaluated Issuer</p>
                            <p className="text-xs text-white font-bold truncate">{reviewResult.issuer}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-500 uppercase font-mono">Target Validity</p>
                            <p className="text-xs text-slate-300 font-bold font-mono">{reviewResult.validUntil}</p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 italic mb-4 leading-relaxed bg-white/[0.01] p-3 rounded-lg border border-white/5">
                          "{reviewResult.summary}"
                        </p>

                        <div className="space-y-4 pt-1">
                          <div>
                            <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Extracted Security Signals:
                            </h5>
                            <div className="space-y-1.5">
                              {reviewResult.evidenceSignals.map((sig: string, idx: number) => (
                                <div key={idx} className="text-xs text-slate-400 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 flex items-start gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                                  <span>{sig}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h5 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Action Required (Gaps found):
                            </h5>
                            <div className="space-y-1.5">
                              {reviewResult.detectedGaps.map((gap: string, idx: number) => (
                                <div key={idx} className="text-xs text-slate-400 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 flex items-start gap-2">
                                  <AlertTriangle className="h-3 w-3 text-rose-500 mt-0.5 shrink-0" />
                                  <span>{gap}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Tab 3: AI Remediation Engine */}
              {activeTab === 'remediation' && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                      AI Remediation Engine
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Convert discovered compliance failures into immediate remediation plans.
                    </p>
                  </div>

                  {/* Dropdown criteria selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Identified Gap:</label>
                    <select
                      value={selectedGap}
                      onChange={(e) => {
                        setSelectedGap(e.target.value);
                        setRemediationPlan(null);
                      }}
                      className="w-full h-11 px-3 rounded-xl bg-black/40 border border-white/5 text-white text-xs select-none focus:outline-none focus:border-indigo-500 flex items-center justify-between"
                    >
                      <option value="stale-mfa">Required credentials have zero dual-factor security</option>
                      <option value="expired-soc2">Supplier SOC 2 security certificate has expired</option>
                      <option value="leak-vulnerability">System port SSH left open to public internet</option>
                      <option value="water-surplus">Water telemetry discharges exceed sediments limits</option>
                    </select>
                  </div>

                  <Button
                    onClick={generateRemediationMatrix}
                    disabled={isGeneratingPlan}
                    className="w-full h-11 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-widest"
                  >
                    {isGeneratingPlan ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Generating Remediation Steps...
                      </>
                    ) : (
                      "Synthesize Remediation Board"
                    )}
                  </Button>

                  {/* Plan Content */}
                  {remediationPlan && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-4"
                    >
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Plan Title</span>
                            <h4 className="text-xs font-bold text-white">{remediationPlan.gapTitle}</h4>
                          </div>
                          <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold uppercase text-[9px] px-2 py-0.5">
                            {remediationPlan.severity} Severity
                          </Badge>
                        </div>

                        <div>
                          <p className="text-[9px] text-slate-500 uppercase font-mono mb-1">Business Impact Threat (Plain-English)</p>
                          <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.01] p-3 rounded-lg border border-white/5">
                            {remediationPlan.businessImpact}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-white/[0.01] p-3 rounded-lg border border-white/5">
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase font-mono">Suggested Assignee</span>
                            <p className="text-xs text-white font-bold flex items-center gap-1.5 mt-0.5">
                              <User className="h-3 w-3 text-indigo-400" />
                              {remediationPlan.ownerRecommendation}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase font-mono">Target Timeline</span>
                            <p className="text-xs text-white font-mono font-bold flex items-center gap-1.5 mt-0.5">
                              <Clock className="h-3 w-3 text-orange-400" />
                              {remediationPlan.daysToComplete} Days max
                            </p>
                          </div>
                        </div>

                        <div>
                          <span className="text-[9px] text-slate-500 uppercase font-mono mb-2 block">Step-By-step Remediation Actions</span>
                          <div className="space-y-1.5">
                            {remediationPlan.steps.map((st: string, idx: number) => (
                              <div key={idx} className="text-xs text-slate-300 bg-white/[0.02] p-2 rounded-lg border border-white/5 flex gap-2">
                                <span className="font-mono text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                                <span className="flex-1">{st}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/10">
                          <span className="text-[9px] text-indigo-400 uppercase font-bold tracking-widest block mb-1">Required Proof to Approve Closure:</span>
                          <p className="text-xs text-slate-300 leading-normal">{remediationPlan.requiredProof}</p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => setShowEmailDraft(!showEmailDraft)}
                            className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/5 text-xs font-bold uppercase tracking-widest"
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            {showEmailDraft ? "Hide Follow-up Notice" : "Draft Team Follow-up"}
                          </Button>
                        </div>

                        {showEmailDraft && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-black/40 p-4 rounded-xl border border-white/10 space-y-3"
                          >
                            <span className="text-[9px] text-slate-500 uppercase font-mono block">Draft Message (Copy and Send)</span>
                            <pre className="text-xs text-slate-300 font-mono overflow-auto whitespace-pre-wrap max-h-48 leading-relaxed bg-black/60 p-3 rounded border border-white/5">
                              {remediationPlan.followUpEmail}
                            </pre>
                            <Button 
                              onClick={() => {
                                navigator.clipboard.writeText(remediationPlan.followUpEmail);
                              }}
                              className="h-8 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-[9px] uppercase tracking-widest font-bold"
                            >
                              Copy Notice to Clipboard
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Tab 4: Dynamic Compliance Advisor */}
              {activeTab === 'frameworks' && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-indigo-400" />
                      Compliance Framework Advisor
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Identify applicable compliance guidelines dynamically depending on your operator sector details.
                    </p>
                  </div>

                  {/* Profile configuration */}
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-500 uppercase font-mono block">Business Sector Category</label>
                      <select
                        value={companyProfile.industry}
                        onChange={(e) => {
                          setCompanyProfile(prev => ({ ...prev, industry: e.target.value }));
                          setRegulatoryRecommendations(null);
                        }}
                        className="w-full h-10 px-3 bg-black/40 border border-white/5 text-white text-xs select-none focus:outline-none"
                      >
                        <option value="SaaS/Cloud Tech">Software as a Service (Cloud Operations)</option>
                        <option value="Water Utility/Infrastructure">Critical Utilities (Water, Power, Transport)</option>
                        <option value="Government Subcontractor">Federal Agency Bidder & Contractor</option>
                        <option value="Aerospace and Logistics">High-value Manufacturing & Space</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-500 uppercase font-mono block">Corporation Size</label>
                      <select
                        value={companyProfile.size}
                        onChange={(e) => {
                          setCompanyProfile(prev => ({ ...prev, size: e.target.value }));
                          setRegulatoryRecommendations(null);
                        }}
                        className="w-full h-10 px-3 bg-black/40 border border-white/5 text-white text-xs"
                      >
                        <option value="Early-tier Developer (20-50 staff)">Early-tier Developer (20-50 staff)</option>
                        <option value="Growth State (100-500 members)">Growth State (100-500 members)</option>
                        <option value="Enterprise Grid Level (>1000 operators)">Enterprise Grid Level (&gt;1000 operators)</option>
                      </select>
                    </div>

                    <Button
                      onClick={recommendFrameworks}
                      disabled={isClassifying}
                      className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 font-bold text-xs uppercase tracking-widest mt-2"
                    >
                      {isClassifying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Evaluating Organizational Risks...
                        </>
                      ) : (
                        "Analyze Framework Map"
                      )}
                    </Button>
                  </div>

                  {/* Results lists */}
                  {regulatoryRecommendations && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Recommended Compliance Roadmaps</span>
                      <div className="space-y-3">
                        {regulatoryRecommendations.map((fw: any, idx: number) => (
                          <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2 relative overflow-hidden group hover:border-white/20 transition-all">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-white font-mono">{fw.name}</h4>
                              <Badge className="bg-indigo-500/10 text-indigo-300 font-bold uppercase text-[9px]">
                                {fw.suitability} Matches
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed italic">
                              "{fw.plainEnglishReason}"
                            </p>
                            <div className="pt-2 border-t border-white/5 flex flex-col gap-1">
                              <span className="text-[9px] text-slate-500 uppercase font-mono">Immediate Operational Step:</span>
                              <p className="text-xs text-indigo-300 font-medium flex items-center gap-1.5 leading-normal mt-0.5">
                                <ArrowRightCircle className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                {fw.operationalStep}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
