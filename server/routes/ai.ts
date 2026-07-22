import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const router = Router();

const isPlaceholderKey = (key?: string) => {
  if (!key) return true;
  const k = key.trim().toLowerCase();
  return k === '' || k === 'your_gemini_api_key_here' || k === 'your_gemini_api_key' || k === 'todo' || k.includes('placeholder');
};

function isApiKeyError(error: any): boolean {
  if (!error) return false;
  
  const keys = ['message', 'status', 'statusText', 'code', 'reason', 'error'];
  let searchCombined = '';
  
  for (const key of keys) {
    if (error[key]) {
      searchCombined += ' ' + String(error[key]);
    }
  }
  
  if (error.error && typeof error.error === 'object') {
    for (const subKey of Object.keys(error.error)) {
      searchCombined += ' ' + String(error.error[subKey]);
    }
  }
  
  try {
    const errorDetails = JSON.stringify(error);
    if (errorDetails !== '{}') {
      searchCombined += ' ' + errorDetails;
    }
  } catch (_) {}
  
  searchCombined += ' ' + String(error);
  searchCombined = searchCombined.toLowerCase();
  
  return (
    searchCombined.includes('api key not valid') ||
    searchCombined.includes('api_key_invalid') ||
    searchCombined.includes('invalid_argument') ||
    searchCombined.includes('invalid api key') ||
    searchCombined.includes('api-key') ||
    searchCombined.includes('unauthorized') ||
    searchCombined.includes('status 400') ||
    searchCombined.includes('status 403') ||
    searchCombined.includes('statuscode 400') ||
    searchCombined.includes('statuscode 403') ||
    searchCombined.includes('keycode') ||
    searchCombined.includes('generative_api_key')
  );
}

// Initialize Gemini API (will use process.env.GEMINI_API_KEY automatically if set)
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const hasAIApi = ai && !isPlaceholderKey(process.env.GEMINI_API_KEY);

router.post('/analyze', async (req, res) => {
  const { context, type } = req.body;
  try {
    if (!hasAIApi) {
      // Return mock data if no API key is present
      if (type === 'risk_detection') {
        return res.json({
          risks: [
            { title: "Unencrypted RDS Instance", category: "Security", severity: "Critical" },
            { title: "Stale IAM Users with Admin Access", category: "Access Control", severity: "High" },
            { title: "Missing S3 Bucket Access Logs", category: "Compliance", severity: "Medium" }
          ]
        });
      }

      if (type === 'risk_mitigation') {
        return res.json({
          mitigation: "Mock Mitigation Plan:\n1. Immediately restrict access to the affected resource.\n2. Enable encryption at rest using AWS KMS.\n3. Rotate all associated credentials.\n4. Update IAM policies to enforce least privilege.\n5. Monitor CloudTrail logs for unauthorized access."
        });
      }
      
      res.json({
        analysis: "Mock AI Analysis: Based on the provided context, we recommend deploying automated hotfix #442 to the staging environment and initiating an emergency SOC 2 control review.",
        confidence: 0.89,
        actionable_steps: [
          "Deploy hotfix #442",
          "Initiate SOC 2 review",
          "Notify security team"
        ]
      });
      return;
    }

    if (type === 'risk_detection') {
      const prompt = `As a CISO AI Assistant, analyze the following context and identify 3-5 specific potential risks: ${context}. Return ONLY a JSON object with a "risks" array. Each risk should have "title", "category" (e.g., Security, Compliance, Operational), and "severity" (Critical, High, Medium, Low).`;
      
      const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
      });

      try {
        const parsedResponse = JSON.parse(response.text || "{}");
        return res.json(parsedResponse);
      } catch (e) {
        console.error("Failed to parse Gemini JSON response", e);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }
    }

    if (type === 'risk_mitigation') {
      const prompt = `As a CISO AI Assistant, provide a concise, step-by-step mitigation plan for the following risk: ${context}. Return ONLY a JSON object with a "mitigation" string field containing the plan.`;
      
      const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
      });

      try {
        const parsedResponse = JSON.parse(response.text || "{}");
        return res.json(parsedResponse);
      } catch (e) {
        console.error("Failed to parse Gemini JSON response", e);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }
    }

    const prompt = `As a CISO AI Assistant, analyze the following ${type} context and provide actionable insights: ${context}`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
    });

    res.json({
      analysis: response.text,
      confidence: 0.95,
      actionable_steps: []
    });
  } catch (error) {
    console.warn("AI Analysis Error (falling back to mock):", error);
    if (type === 'risk_detection') {
      return res.json({
        risks: [
          { title: "Unencrypted RDS Instance", category: "Security", severity: "Critical" },
          { title: "Stale IAM Users with Admin Access", category: "Access Control", severity: "High" },
          { title: "Missing S3 Bucket Access Logs", category: "Compliance", severity: "Medium" }
        ]
      });
    }
    if (type === 'risk_mitigation') {
      return res.json({
        mitigation: "Mock Mitigation Plan:\n1. Immediately restrict access to the affected resource.\n2. Enable encryption at rest using AWS KMS.\n3. Rotate all associated credentials.\n4. Update IAM policies to enforce least privilege.\n5. Monitor CloudTrail logs for unauthorized access."
      });
    }
    return res.json({
      analysis: "Mock AI Analysis: Based on the provided context, we recommend deploying automated hotfix #442 to the staging environment and initiating an emergency SOC 2 control review.",
      confidence: 0.89,
      actionable_steps: [
        "Deploy hotfix #442",
        "Initiate SOC 2 review",
        "Notify security team"
      ]
    });
  }
});

// New AI Vendor Assessment Generator API
router.post('/gov-assessment', async (req, res) => {
  const { name, vendorType, sector, country, services, frameworks, incidents, agencyMode } = req.body;

  const mockResponse = {
    riskSummary: `Critical software service "${name}" is registered in "${country}" for "${services}". For ${agencyMode?.toUpperCase() || 'DHS'} operations, this partner introduces key vector liabilities under regulatory supply chain controls.`,
    topRisks: [
      { risk: `Data Sovereignty Violations`, description: `Potential foreign data hosting or transmission across ${country} jurisdictions, violating national security directives.` },
      { risk: `Insecure Access Path Integration`, description: `Integration of "${services}" lacks robust multifactor enforcement, allowing potential credential spray vulnerabilities.` },
      { risk: `Compliance Framework Gaps`, description: `Incomplete mapping to ${frameworks || "NIST CSF / FedRAMP"} requirements creates audit exposure for agency oversight.` },
      { risk: `Supply Chain Tampering Danger`, description: `Sub-service vendor dependency creates a blind spot where malicious updates can bypass code signing controls.` },
      { risk: `Historical Integrity Risk`, description: incidents ? `Known incidents: "${incidents}". Illustrates operational susceptibility to recurrent threat actor campaigns.` : `Lack of structural audit verification history increases initial operational caution.` }
    ],
    mitigations: [
      `Mandate transition to US-based multi-region isolated cloud endpoints.`,
      `Enforce strict SAML / OIDC single sign-on access with conditional device controls.`,
      `Initiate automated baseline telemetry verification scans directly from Guardentra.`,
      `Require formal attestation to NIST 800-53 or FedRAMP High controls within 90 days.`,
      `Establish formal liability clauses with continuous 15-minute SLA breach notification windows.`
    ],
    evidenceDocs: [
      `SOC 2 Type II Audited Attestation Report (last 12 months)`,
      `FedRAMP System Security Plan (SSP) (for government use)`,
      `Data Residency & Sovereignty Policy Statement`,
      `Penetration Testing Summary with Remediation Receipts`,
      `Business Continuity & Disaster Recovery Simulation Logs`
    ],
    monitoringFrequency: `Bi-weekly continuous automated scanning (High Risk Profile)`,
    executiveSummary: `This third-party assessment determines that "${name}" presents a manageable risk profile for ${agencyMode?.toUpperCase() || 'DHS'} operations, provided the recommended evidence locker attestations are uploaded and continuous automated telemetry is initialized.`
  };

  try {
    if (!hasAIApi) {
      return res.json(mockResponse);
    }

    const prompt = `You are Guardentra AI, an elite federal third-party risk intelligence engine.
    Analyze this vendor for agency demo mode ${agencyMode?.toUpperCase() || 'DHS'}:
    - Name: ${name}
    - Type: ${vendorType}
    - Sector: ${sector}
    - Country: ${country}
    - Services: ${services}
    - Known Frameworks: ${frameworks}
    - Known Incidents/Concerns: ${incidents}

    You must output a structured Risk Assessment following this exact schema:
    - riskSummary: A short paragraph summarizing the risk posture.
    - topRisks: Array of 5 risk objects, each with 'risk' (name of risk) and 'description' (clear detail).
    - mitigations: Array of 5 explicit actionable steps to mitigate these risks.
    - evidenceDocs: Array of 5 required evidence documents for their locker.
    - monitoringFrequency: Text suggesting standard or custom audit frequency.
    - executiveSummary: A clear board-ready strategic summary paragraph.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskSummary: { type: Type.STRING },
            topRisks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  risk: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ['risk', 'description']
              }
            },
            mitigations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            evidenceDocs: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            monitoringFrequency: { type: Type.STRING },
            executiveSummary: { type: Type.STRING }
          },
          required: ['riskSummary', 'topRisks', 'mitigations', 'evidenceDocs', 'monitoringFrequency', 'executiveSummary']
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (e) {
      console.error("Gemini parse failed, falling back to mock", e);
      return res.json(mockResponse);
    }
  } catch (error) {
    console.warn("Gov Assessment Error (falling back to mock):", error);
    return res.json(mockResponse);
  }
});

// New Government Grant Readiness / Alignment Report API
router.post('/grant-report', async (req, res) => {
  const { agencyMode } = req.body;

  const mockReports: Record<string, any> = {
    dhs: {
      problemStatement: `Critical infrastructure sectors face severe, asymmetrical supply-chain vulnerabilities from untrusted third-party software, leaving national power, water, and cybersecurity grids exposed to state-sponsored intrusion.`,
      publicSectorRelevance: `Aligned directly with the DHS Science and Technology Directorate's mission to protect critical software pipelines and the Cybersecurity and Infrastructure Security Agency's (CISA) Strategic Plan on Supply Chain Risk Management (SCRM).`,
      targetUsers: `Chief Information Security Officers (CISOs), Federal Contractors, Critical Infrastructure Operators (Energy, Transportation, Financial Sectors), and CISA security reviewers.`,
      coreCapabilities: `Real-time automated vendor risk telemetry, multi-factor sovereign trust indexing, active liability and contract compliance auditing, and continuous evidence locker verification.`,
      expectedImpact: `Ensures 100% compliance with CISA/NIST SCRM guidelines, decreasing vendor threat exposure by up to 65% and reducing administrative audit preparation time from weeks to minutes.`,
      pilotUseCase: `Deployment of Guardentra to continuously assess and verify the hardware/software supply chain of 15 regional utilities operating under the Federal Energy Regulatory Commission (FERC).`,
      privacySecurity: `Sovereign US-based data residency, role-based access control (RBAC), end-to-end TLS 1.3 encryption, and an AI disclaimer assuring that zero federal audit datasets are utilized for public model training.`,
      nextSteps: `Schedule a 30-minute technological capability briefing with the DHS SCRM Task Force, prepare pilot testing parameters, and file a formal proposal response under SBIR Phase I.`
    },
    commerce: {
      problemStatement: `SMEs and enterprise buyers struggle with opaque supplier ecosystems, creating substantial trade friction and economic reliance on single-sourced, high-risk components that threaten US market durability.`,
      publicSectorRelevance: `Directly aligns with the Department of Commerce, Bureau of Industry and Security (BIS), and CHIPS for America Program's emphasis on supplier transparency, industrial economic resilience, and domestic technology security.`,
      targetUsers: `Trade Analysts, Corporate Procurement Officers, Domestic Semiconductor Providers, Aerospace Contractors, and Federal Trade Officers.`,
      coreCapabilities: `Economic vulnerability detection, single-point-of-failure supplier visualization, trust index scores mapping market dependency risks, and automated regulatory compliance matching.`,
      expectedImpact: `Enhances domestic supply chain visibility by 80%, facilitates secure, diversified procurement pipelines, and lowers market barrier entry costs for highly compliant SMEs.`,
      pilotUseCase: `Implementing Guardentra as the primary third-party risk intelligence engine for 10 key microelectronics manufacturers to map background sub-component compliance.`,
      privacySecurity: `Rigorous multi-tenant isolation, automated audit logging, granular document access permissions, and an absolute non-disclosure configuration of supply chain analytics datasets.`,
      nextSteps: `Engage the Commerce Department's Supply Chain Center for an operational sandbox collaboration and coordinate on a joint trade intelligence briefing paper.`
    },
    epa: {
      problemStatement: `Water, waste management, and industrial suppliers often fail to report structural environmental compliance gaps, leaving supply chains vulnerable to severe regulatory fines and environmental safety shutdowns.`,
      publicSectorRelevance: `Directly aligns with the EPA Office of Enforcement and Compliance Assurance (OECA) Strategic Plan and the Clean Water Act / Clean Air Act vendor accountability requirements.`,
      targetUsers: `Municipal Supply Managers, Environmental Auditors, Sustainability Directors, Water District Administrators, and Compliance Inspectors.`,
      coreCapabilities: `Environmental risk telemetry tracking, carbon emission attestation verification, EPA civil penalty dataset cross-referencing, and automated chemical safety audit reporting.`,
      expectedImpact: `Eliminates up to 90% of sub-tier compliance failures, ensures strict adherence to federal sustainability mandates, and protects municipal water assets from operational downtime.`,
      pilotUseCase: `A multi-municipal pilot deploying Guardentra to oversee and audit 40 private chemical, transport, and raw material vendors supplying critical regional water treatment plants.`,
      privacySecurity: `Role-based data masking, encryption of chemical asset inventories, local data sovereignty controls, and high-integrity human-override validation pathways.`,
      nextSteps: `Co-author a municipal pilot framework with the EPA Office of Water, establishing continuous environmental compliance telemetry baselines.`
    }
  };

  const parsedMode = (agencyMode || 'dhs').toLowerCase();
  const activeMock = mockReports[parsedMode] || mockReports.dhs;

  try {
    if (!hasAIApi) {
      return res.json(activeMock);
    }

    const prompt = `You are Guardentra AI, an elite federal grant strategist.
    Write a highly persuasive, detailed Federal Grant Readiness and Alignment Report for the ${agencyMode?.toUpperCase() || 'DHS'} Agency Mode.
    Ensure it is highly professional, formal, and authoritative.
    
    The response must be structured JSON following this schema:
    - problemStatement: The primary national or agency-specific third-party risk problem solved.
    - publicSectorRelevance: How this matches the agency's mission, executive orders, or specific guidelines (e.g. CISA, NIST, Clean Water Act, Dept of Commerce mandates).
    - targetUsers: Critical federal, contractor, or municipal roles that will use this.
    - coreCapabilities: Key software capabilities that solve this specific agency's risk pipeline problems.
    - expectedImpact: Quantified, powerful projected outcomes (e.g., % risk reduction, audit speed).
    - pilotUseCase: A highly specific, realistic pilot use-case proposal.
    - privacySecurity: Security architecture detail, data minimization, disclaimer about non-training on AI.
    - nextSteps: Key strategic milestones to initiate with the agency.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            problemStatement: { type: Type.STRING },
            publicSectorRelevance: { type: Type.STRING },
            targetUsers: { type: Type.STRING },
            coreCapabilities: { type: Type.STRING },
            expectedImpact: { type: Type.STRING },
            pilotUseCase: { type: Type.STRING },
            privacySecurity: { type: Type.STRING },
            nextSteps: { type: Type.STRING }
          },
          required: [
            'problemStatement', 
            'publicSectorRelevance', 
            'targetUsers', 
            'coreCapabilities', 
            'expectedImpact', 
            'pilotUseCase', 
            'privacySecurity', 
            'nextSteps'
          ]
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (e) {
      console.error("Gemini report generation failed, falling back to mock", e);
      return res.json(activeMock);
    }
  } catch (error) {
    console.warn("Grant Report Error (falling back to mock):", error);
    return res.json(activeMock);
  }
});

// New Trust Score Explainer API
router.post('/trust-explain', async (req, res) => {
  const { scoreDetails } = req.body;
  const { overallScore, complianceHealth, vendorRiskHealth, evidenceHealth, controlCoverage, incidentExposure } = scoreDetails || {};

  const mockResponse = {
    explanation: `Your Trust Score of ${overallScore || 82} reflects a mature, defense-in-depth posture with key strengths in automated telemetry and regulatory tracking. However, uncompleted security assessments across long-tail vendors prevent achieving maximum level certification.`,
    positives: [
      `Control coverage is solid at ${controlCoverage || 88}%, showing excellent automated software connections.`,
      `Low risk density from security incidents, preserving a ${incidentExposure || 95}% operational stability index.`
    ],
    negatives: [
      `Framework progress leaves a ${100 - (complianceHealth || 85)}% delta before complete NAIC validation is achieved.`,
      `Third-party assessment ratings average ${vendorRiskHealth || 74}%, identifying pending vendor risk reviews as a primary bottleneck.`
    ],
    nextSteps: [
      `Complete outstanding third-party risk scans for critical supply-chain partners to reclaim up to +10 trust points.`,
      `Activate unused OIDC or endpoint infrastructure connectors under integrations to verify security controls.`,
      `Approve active policy drafts in the Audit lab to expand formal evidence library completeness.`
    ]
  };

  try {
    if (!hasAIApi) {
      return res.json(mockResponse);
    }

    const prompt = `You are Guardentra AI, an elite security compliance and trust operations analyst.
    Analyze the following multi-factor trust score breakdown of an organization:
    - Overall Trust Score: ${overallScore} / 100
    - Compliance Health (Frameworks Progress): ${complianceHealth}% (Weight: 30%)
    - Vendor Risk Health (Third-Party Posture): ${vendorRiskHealth}% (Weight: 25%)
    - Evidence Health (Active Policies): ${evidenceHealth}% (Weight: 20%)
    - Control Coverage (Connected Telemetry): ${controlCoverage}% (Weight: 15%)
    - Incident Exposure (Active Vulnerabilities): ${incidentExposure}% (Weight: 10%)

    Provide an explainable and strategic analysis inside a structured JSON object. Focus on explaining:
    1. Why is the overall score exactly ${overallScore}?
    2. What specific components drove the score up (positives)?
    3. What specific components are pulling the score down (negatives)?
    4. What are 3 clear, concrete next steps the organization should execute to raise the score?

    JSON Schema:
    {
      "explanation": string, (A board-ready strategic summary paragraph under 3 sentences. Do not mention mathematical weight equations; talk about real-world enterprise risk.)
      "positives": string[], (Exactly 2 strong points of security posture found.)
      "negatives": string[], (Exactly 2 compliance gaps or risk items that need fixing.)
      "nextSteps": string[] (Exactly 3 highly actionable, clear things they can do in Guardentra to immediately raise their score, mentioning the specific point improvements.)
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            positives: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            negatives: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            nextSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['explanation', 'positives', 'negatives', 'nextSteps']
        }
      }
    });

    try {
      const parsedRes = JSON.parse(response.text || "{}");
      return res.json(parsedRes);
    } catch (e) {
      console.error("Gemini parse failed for trust-explain, falling back to mock", e);
      return res.json(mockResponse);
    }
  } catch (err) {
    console.warn("Trust Explain Error (falling back to mock):", err);
    return res.json(mockResponse);
  }
});

// New AI Evidence Review Engine API
router.post('/evidence-review', async (req, res) => {
  const { documentType, fileName, fileContent, vendorName } = req.body;

  const mockResponseByDocType: Record<string, any> = {
    'SOC 2 Reports': {
      executiveSummary: `The SOC 2 Type II GRC analysis of the uploaded report "${fileName || 'attestation.pdf'}" for ${vendorName || 'the vendor'} shows a robust core posture with standard control coverages. The system verification confirms automated daily firewall rule synchronization, multi-region encrypted database replication times, and formal security awareness training completions. However, minor deviance is noted regarding non-production MFA audit coverage.`,
      keyFindings: [
        { finding: "Automated daily firewall ruleset sync verifies data separation policies.", severity: "Low", impact: "Maintains clear tenant multi-tenant boundary isolations." },
        { finding: "Database daily snapshots are automatically encrypted and backed up.", severity: "Low", impact: "Zero risk of data loss on critical system failovers." },
        { finding: "Non-production environment endpoints allow single-factor login credentials.", severity: "High", impact: "Exposes secondary endpoints to credential leaks or database harvesting." }
      ],
      detectedRisks: [
        { risk: "Credentials reuse across test environments bypasses core single sign-on policy gates.", impactScore: 68, coverage: "Access Control (CC6.1)" },
        { risk: "Stale developer keys are active on decommissioned repositories.", impactScore: 45, coverage: "Risk Assessment (CC3.2)" }
      ],
      missingEvidence: [
        { evidenceName: "Database Configuration Drift Reports", reason: "While logs confirm file backups, drift metrics are absent from audit exhibits.", priority: "Medium" },
        { evidenceName: "Quarterly Access Review Attestation", reason: "Verification of deactivated employees is not clearly documented in Annex B.", priority: "High" }
      ],
      recommendations: [
        { action: "Implement mandatory SAML/OIDC SSO with MFA on developer staging terminals.", timeframe: "30 days", difficulty: "Moderate" },
        { action: "De-provision subkey systems older than 90 days across GitHub pipelines.", timeframe: "15 days", difficulty: "Easy" }
      ],
      expirationDate: "2027-04-15",
      complianceSignal: "Partial"
    },
    'ISO Certificates': {
      executiveSummary: `The ISO/IEC 27001:2022 Information Security Management System certification for ${vendorName || 'the vendor'} covers global cloud hosting facilities, database clusters, and deployment nodes. Certification is fully active and validated under reputable registrar oversight, affirming robust physical and administrative compliance controls.`,
      keyFindings: [
        { finding: "ISMS operates under regular internal vulnerability inspections.", severity: "Low", impact: "Proactive identification of configuration failures." },
        { finding: "Access controls mandate physical server checks for server racks.", severity: "Low", impact: "High protection of local bare-metal components." }
      ],
      detectedRisks: [
        { risk: "Third-party dependency chain exhibits missing certifications.", impactScore: 35, coverage: "Supplier Relations (A.15)" }
      ],
      missingEvidence: [
        { evidenceName: "External Network Vulnerability Penetration Report", reason: "Scope of audit lists penetration drills, but the specific reports are excluded.", priority: "High" }
      ],
      recommendations: [
        { action: "Request complete external pentesting details from the target vendor's CISO.", timeframe: "14 days", difficulty: "Easy" }
      ],
      expirationDate: "2026-10-10",
      complianceSignal: "Compliant"
    },
    'Security Policies': {
      executiveSummary: `The uploaded Information Security Policy document for ${vendorName || 'the vendor'} outlines high-level administrative constraints regarding access paths, remote workstations, and employee lifecycle procedures. While policy definitions exist, technical configurations to enforce these rules on SaaS interfaces are sparsely explained.`,
      keyFindings: [
        { finding: "Password complexity standards are defined but lack concrete enforcement rules.", severity: "Medium", impact: "Users may select guessable passwords on public web portals." },
        { finding: "Enterprise background screening policy is applied to all new hires.", severity: "Low", impact: "Prevents insider risk during operational workflows." }
      ],
      detectedRisks: [
        { risk: "Lack of explicit rule definitions regarding offshore subcontractor data routing.", impactScore: 55, coverage: "Operations Security (CC7.1)" }
      ],
      missingEvidence: [
        { evidenceName: "SaaS Application Security Policy", reason: "Enterprise policy lacks customized controls for third-party cloud environments.", priority: "Medium" }
      ],
      recommendations: [
        { action: "Amend security policy to define specific offshore data routing rules.", timeframe: "60 days", difficulty: "Moderate" }
      ],
      expirationDate: "Not specified",
      complianceSignal: "Partial"
    },
    'Vendor Questionnaires': {
      executiveSummary: `Review of the self-assessed Risk Assessment and Compliance Survey submitted by ${vendorName || 'the vendor'} indicates moderate compliance. A key risk area is identified in data retention lifetimes and standard multi-tenant environment configurations. Critical validations rely heavily on manual procedures rather than cloud guardrails.`,
      keyFindings: [
        { finding: "Data lifetimes are manually monitored by database administrators rather than scripts.", severity: "Medium", impact: "Risk of keeping user data way beyond standard contractual boundaries." },
        { finding: "Physical disaster fallback plan is simulated only once per 18 months.", severity: "Medium", impact: "Slow recovery or data lag during severe primary region blackouts." }
      ],
      detectedRisks: [
        { risk: "Lack of automated config compliance monitors introduces potential human errors.", impactScore: 60, coverage: "Governance & Risk Management" }
      ],
      missingEvidence: [
        { evidenceName: "Formal DR Failover Simulation Drills Log", reason: "Last recorded failover test occurred over 14 months ago.", priority: "High" }
      ],
      recommendations: [
        { action: "Implement automatic lifecycle policies to purge staging database files after 180 days.", timeframe: "30 days", difficulty: "Easy" }
      ],
      expirationDate: "2026-11-20",
      complianceSignal: "Non-Compliant"
    },
    'Audit Reports': {
      executiveSummary: `The Internal Security Audit Report for ${vendorName || 'the vendor'} demonstrates positive framework alignment but highlights gaps in continuous monitoring pipelines. Access tracking contains notable administrative blind spots on legacy subcontractor databases.`,
      keyFindings: [
        { finding: "Continuous monitoring checks are not fully initialized across active cloud databases.", severity: "Medium", impact: "Delayed intrusion detection if database nodes are exposed." },
        { finding: "Root API credentials are log-tracked on central monitoring dashboard.", severity: "Low", impact: "Consistent transparency of privileged actions." }
      ],
      detectedRisks: [
        { risk: "Unlogged access tracks on historical staging clusters.", impactScore: 52, coverage: "Monitoring & Audit Controls" }
      ],
      missingEvidence: [
        { evidenceName: "Historical DB Query Audit Logs", reason: "Logs on staging targets were rotated and permanently deleted after 14 days.", priority: "High" }
      ],
      recommendations: [
        { action: "Configure longer log retention time spans (minimum 90 days) for analytical pipelines.", timeframe: "15 days", difficulty: "Easy" }
      ],
      expirationDate: "Not specified",
      complianceSignal: "Partial"
    }
  };

  const docTypeKey = documentType || 'SOC 2 Reports';
  const mockResponse = mockResponseByDocType[docTypeKey] || mockResponseByDocType['SOC 2 Reports'];

  try {
    if (!hasAIApi) {
      return res.json(mockResponse);
    }

    const prompt = `You are Guardentra AI, an elite GRC (Governance, Risk, and Compliance) auditing engine.
    Analyze the following compliance evidence document details for our third-party vendor ${vendorName || 'the vendor'}:
    - Document Type Selected: ${documentType}
    - Document File Name: ${fileName || 'evidence_doc.txt'}
    - Document Text Content or Metadata: ${fileContent || 'No visual description/content uploaded.'}

    You must perform a detailed compliance review of this GRC material and output a JSON object adhering exactly to this schema:
    1. executiveSummary: string (a professional, detailed summary covering the security posture, scope, and key conclusions).
    2. keyFindings: array of objects with fields 'finding' (detailed text), 'severity' ('Critical'|'High'|'Medium'|'Low'), 'impact' (risks or benefits).
    3. detectedRisks: array of objects with fields 'risk' (name of risk vector), 'impactScore' (integer 0-100), 'coverage' (policy domain or standard section mapped).
    4. missingEvidence: array of objects with fields 'evidenceName' (evidence document name missing), 'reason' (why it is critical or expected), 'priority' ('High'|'Medium'|'Low').
    5. recommendations: array of objects with fields 'action' (remediation step), 'timeframe' (due day constraint, e.g. "30 days"), 'difficulty' ('Easy'|'Moderate'|'Complex').
    6. expirationDate: string (detected document expiration date, e.g. "2027-04-15" or "Not specified").
    7. complianceSignal: string ('Compliant' | 'Partial' | 'Non-Compliant').

    Ensure all fields are detailed and realistic. The findings must directly reference security controls suitable for the document type.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            keyFindings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  finding: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  impact: { type: Type.STRING }
                },
                required: ['finding', 'severity', 'impact']
              }
            },
            detectedRisks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  risk: { type: Type.STRING },
                  impactScore: { type: Type.INTEGER },
                  coverage: { type: Type.STRING }
                },
                required: ['risk', 'impactScore', 'coverage']
              }
            },
            missingEvidence: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  evidenceName: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  priority: { type: Type.STRING }
                },
                required: ['evidenceName', 'reason', 'priority']
              }
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING },
                  timeframe: { type: Type.STRING },
                  difficulty: { type: Type.STRING }
                },
                required: ['action', 'timeframe', 'difficulty']
              }
            },
            expirationDate: { type: Type.STRING },
            complianceSignal: { type: Type.STRING }
          },
          required: [
            'executiveSummary',
            'keyFindings',
            'detectedRisks',
            'missingEvidence',
            'recommendations',
            'expirationDate',
            'complianceSignal'
          ]
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (e) {
      console.error("Gemini evidence review failed, falling back to mock:", e);
      return res.json(mockResponse);
    }

  } catch (error) {
    console.warn("Evidence Review Error (falling back to mock):", error);
    return res.json(mockResponse);
  }
});

// New AI Remediation Plan Generator API
router.post('/remediation-plan', async (req, res) => {
  const { finding, recommendation, vendorName } = req.body;

  const mockResponse = {
    finding: finding || "Incomplete SSO/MFA enforcement on administrative endpoints",
    severity: "High",
    businessImpact: `Exposes internal staging database connections of ${vendorName || 'the partner'} to unauthorized access, risking data leak of customer telemetry under GDPR or HIPAA.`,
    recommendedFix: "Enforce enterprise SAML single sign-on with strict IP boundary gates and dual-factor validation checkpoints.",
    priority: "High",
    dueDate: "2026-06-15",
    ownerSuggestion: "Lead Identity Access Engineer",
    requiredEvidence: "OIDC/SSO configuration export showing multi-factor enforcement, and a visual penetration test signoff sheet.",
    problem: finding || "Missing or incomplete MFA enforcement on active administrative endpoints",
    impact: "An adversary possessing credentials could authenticating directly to staging nodes without security challenger prompts.",
    recommendedAction: "Migrate all administrative log-in routes to root corporate credentials managed strictly by an identity provider.",
    deadline: "2026-06-15",
    successCriteria: "Successful test login verifies that a second authentication factor is structurally requested and verified before session initialization."
  };

  try {
    if (!hasAIApi) {
      return res.json(mockResponse);
    }

    const prompt = `You are Guardentra AI, an elite security compliance and trust officer.
    Generate a comprehensive remediation plan for this compliance finding:
    - Finding Description: ${finding}
    - Recommended action so far: ${recommendation || "Not specified"}
    - Vendor Name: ${vendorName || "Third-Party Service Provider"}

    The current date is June 1, 2026. All generated absolute due dates/deadlines must occur in the year 2026 (or early 2027 for low risk items).
    Ensure everything is highly actionable, clear, and professional.

    You must output a structured JSON object with the following exact keys:
    1. finding: string (original finding name or concise label)
    2. severity: string ('Critical' | 'High' | 'Medium' | 'Low')
    3. businessImpact: string (how this affects the operational and business continuity)
    4. recommendedFix: string (prescriptive, technical instructions for how to implement the remedy)
    5. priority: string ('High' | 'Medium' | 'Low')
    6. dueDate: string (a calendar date like "June 15, 2026" or "2026-06-15" aligned with severity and priority)
    7. ownerSuggestion: string (the suggested role/entity responsible for fixing this e.g., "Lead DevOps Engineer", "CISO")
    8. requiredEvidence: string (specific confirmation artifact, document, or log needed to prove remediation is complete)
    9. problem: string (human-friendly, expanded explanation of the risk problem)
    10. impact: string (what bad thing would happen/impact if left unmitigated)
    11. recommendedAction: string (the direct corrective action step to execute)
    12. deadline: string (deadline date matching dueDate)
    13. successCriteria: string (clear description of the test metric or test outcome that certifies success)

    Ensure all fields are fully populated with realistic enterprise GRC data and are TypeScript-safe.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            finding: { type: Type.STRING },
            severity: { type: Type.STRING },
            businessImpact: { type: Type.STRING },
            recommendedFix: { type: Type.STRING },
            priority: { type: Type.STRING },
            dueDate: { type: Type.STRING },
            ownerSuggestion: { type: Type.STRING },
            requiredEvidence: { type: Type.STRING },
            problem: { type: Type.STRING },
            impact: { type: Type.STRING },
            recommendedAction: { type: Type.STRING },
            deadline: { type: Type.STRING },
            successCriteria: { type: Type.STRING }
          },
          required: [
            'finding', 'severity', 'businessImpact', 'recommendedFix', 'priority', 
            'dueDate', 'ownerSuggestion', 'requiredEvidence', 'problem', 'impact', 
            'recommendedAction', 'deadline', 'successCriteria'
          ]
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (e) {
      console.error("Gemini remediation-plan parse failed, falling back to mock", e);
      return res.json(mockResponse);
    }
  } catch (err) {
    console.warn("Remediation Plan Generation Error (falling back to mock):", err);
    return res.json(mockResponse);
  }
});

// New Gmail Audit and GRC Compliance Scan API
router.post('/analyze-emails', async (req, res) => {
  const { emails } = req.body;

  const mockResponse = {
    analyzedEmails: [
      {
        id: "msg_1",
        subject: "ALERT: GitHub Access Token Exposed in Public Repo",
        from: "security@github.com",
        date: new Date().toLocaleString(),
        isGrcRelevant: true,
        summary: "A private OAuth token was detected on a public GitHub repository branch. Immediate revocation is required to secure corporate resources.",
        riskLevel: "Critical",
        regulatoryTags: ["SOC 2 CC6.1", "ISO 27001 A.12.6.1", "NIST PR.AC-1"],
        actionNeeded: "Revoke the exposed credential immediately in the developer console. Verify repo access logs for unauthorized activity.",
        confidence: 0.98
      },
      {
        id: "msg_2",
        subject: "AWS Security Hub: S3 Bucket 'guardentra-prod-billing' is Public",
        from: "aws-security-hub@amazon.com",
        date: new Date().toLocaleString(),
        isGrcRelevant: true,
        summary: "S3 public read permissions have been applied to a billing information storage bucket, violating data privacy controls.",
        riskLevel: "High",
        regulatoryTags: ["GDPR Art 32", "SOC 2 CC6.3", "HIPAA §164.312"],
        actionNeeded: "Block all public access on the bucket configuration. Apply strict KMS encryption and update resource policies.",
        confidence: 0.95
      },
      {
        id: "msg_3",
        subject: "SOC 2 Type II Final Attestation Report Available",
        from: "audit-services@crowe.com",
        date: new Date(Date.now() - 3600000 * 24).toLocaleString(),
        isGrcRelevant: true,
        summary: "Annual independent audit attestation has been successfully published for the production host system with zero exceptions noted.",
        riskLevel: "None",
        regulatoryTags: ["SOC 2 CC1.1", "Audit Attestation"],
        actionNeeded: "Archive the PDF attestation report inside the Guardentra Trust Vault for active client sharing.",
        confidence: 0.99
      },
      {
        id: "msg_4",
        subject: "Daily Team Standup Sync Sync Link",
        from: "meeting-manager@slack.com",
        date: new Date().toLocaleString(),
        isGrcRelevant: false,
        summary: "Standard routine team coordination meeting invitation. Unrelated to GRC or security risks.",
        riskLevel: "None",
        regulatoryTags: [],
        actionNeeded: "No compliance or GRC action required.",
        confidence: 0.90
      }
    ],
    overallRiskRating: "High",
    auditSummary: "Gmail audit scan detected 2 active GRC-relevant alerts requiring immediate containment. AWS S3 configuration exposure and GitHub key leak violate multiple core framework controls."
  };

  try {
    if (!hasAIApi || !emails || !Array.isArray(emails) || emails.length === 0) {
      return res.json(mockResponse);
    }

    const emailContext = emails.map((m, idx) => `
    [Email ${idx + 1}]
    ID: ${m.id}
    From: ${m.from}
    Subject: ${m.subject}
    Snippet: ${m.snippet}
    Date: ${m.date}
    `).join('\n\n');

    const prompt = `You are Guardentra AI, an elite GRC Compliance auditor and security analyst.
    Analyze the following list of recent emails from a corporate mailbox to identify:
    1. If the email is relevant to Governance, Risk, Compliance, or Information Security (isGrcRelevant).
    2. A professional CISO-level summary of the issue.
    3. The risk level ('Critical' | 'High' | 'Medium' | 'Low' | 'None').
    4. Regulatory framework tags violated or referred to (e.g., SOC 2 CC6.1, GDPR Art 32, ISO 27001).
    5. The specific remediation action needed to resolve or handle the finding.
    6. Your analysis confidence level (0.0 to 1.0).

    Emails to analyze:
    ${emailContext}

    Ensure your response is valid JSON structured with the following exact keys:
    - analyzedEmails: Array of objects, each containing:
      - id (string, matching the email ID passed in)
      - subject (string)
      - from (string)
      - date (string)
      - isGrcRelevant (boolean)
      - summary (string)
      - riskLevel (string: 'Critical' | 'High' | 'Medium' | 'Low' | 'None')
      - regulatoryTags (Array of strings, e.g., ["SOC 2 CC6.3"])
      - actionNeeded (string)
      - confidence (number)
    - overallRiskRating (string: 'Critical' | 'High' | 'Medium' | 'Low' | 'None')
    - auditSummary (string: executive summary of the entire email batch scan)
    
    Adhere strictly to the requested JSON response format.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analyzedEmails: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  from: { type: Type.STRING },
                  date: { type: Type.STRING },
                  isGrcRelevant: { type: Type.BOOLEAN },
                  summary: { type: Type.STRING },
                  riskLevel: { type: Type.STRING },
                  regulatoryTags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  actionNeeded: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                },
                required: ['id', 'subject', 'from', 'date', 'isGrcRelevant', 'summary', 'riskLevel', 'regulatoryTags', 'actionNeeded', 'confidence']
              }
            },
            overallRiskRating: { type: Type.STRING },
            auditSummary: { type: Type.STRING }
          },
          required: ['analyzedEmails', 'overallRiskRating', 'auditSummary']
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (e) {
      console.error("Gemini email audit parse failed:", e);
      return res.json(mockResponse);
    }

  } catch (err) {
    console.warn("Gmail Audit API Error (falling back to mock):", err);
    return res.json(mockResponse);
  }
});

export default router;
