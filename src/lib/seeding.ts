import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface SeedOptions {
  organizationId: string;
  industry: string;
  frameworks: string[];
}

export async function seedProfessionalData({ organizationId, industry, frameworks }: SeedOptions) {
  try {
    console.log(`Seeding data for org: ${organizationId}, industry: ${industry}`);

    // 1. Seed Risks based on Industry and Frameworks
    const risks = [
      {
        title: "NYDFS Part 500 Certification Drift",
        category: "Regulatory Compliance",
        severity: "Critical",
        status: "Open",
        impact: 5,
        likelihood: 3,
        mitigation: "Conduct weekly automated certification gap analysis and update CISO dashboard.",
      },
      {
        title: "Inadequate vendor risk management program",
        category: "Third-Party Risk",
        severity: "High",
        status: "Open",
        impact: 4,
        likelihood: 4,
        mitigation: "Implement automated vendor assessment workflows and quarterly reviews.",
      },
      {
        title: "Unencrypted PII discovered in development environments",
        category: "Data Privacy",
        severity: "High",
        status: "Mitigated",
        impact: 5,
        likelihood: 2,
        mitigation: "Deployed data masking scripts and updated developer security training.",
      },
      {
        title: "NAIC Data Security Model Law Alignment Gap",
        category: "Insurance Compliance",
        severity: "High",
        status: "In Progress",
        impact: 4,
        likelihood: 3,
        mitigation: "Map internal controls to NAIC sections and automate evidence gathering.",
      }
    ];

    for (const risk of risks) {
      await addDoc(collection(db, 'risks'), {
        ...risk,
        owner: 'System Audit',
        organizationId,
        createdAt: new Date().toISOString()
      });
    }

    // 2. Seed Policies (Insurance focused)
    const policies = [
      {
        title: "Cybersecurity Asset Management Policy",
        category: "NYDFS Compliance",
        status: "Active",
        version: "1.0",
        content: "# Cybersecurity Asset Management Policy\nThis policy defines requirements for maintaining a complete inventory of assets per NYDFS 500.13...",
      },
      {
        title: "Incident Response Plan (NAIC Aligned)",
        category: "Operations",
        status: "Active",
        version: "2.1",
        content: "# Incident Response Plan\nSteps to be taken during a security incident: 1. Identification, 2. Containment... This plan aligns with NAIC 72-hour reporting requirements.",
      },
      {
        title: "Acceptable Use Policy",
        category: "Governance",
        status: "Active",
        version: "1.2",
        content: "# Acceptable Use Policy\nGuidelines for the proper use of company assets and intellectual property...",
      }
    ];

    for (const policy of policies) {
      await addDoc(collection(db, 'policies'), {
        ...policy,
        organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 3. Seed Vendors (Insurance SaaS)
    const vendors = [
      {
        name: "Guidewire Cloud",
        category: "Policy Administration",
        criticality: "Critical",
        status: "Active",
        riskScore: 85,
        reputation: "Industry standard for insurance core systems."
      },
      {
        name: "Snapsheet",
        category: "Claims Processing",
        criticality: "High",
        status: "Active",
        riskScore: 92,
        reputation: "Digital claims management with strong SOC 2 posture."
      },
      {
        name: "Amazon Web Services (AWS)",
        category: "Infrastructure",
        criticality: "Critical",
        status: "Active",
        riskScore: 98,
        reputation: "Hosting core insurance workloads."
      }
    ];

    for (const vendor of vendors) {
      await addDoc(collection(db, 'vendors'), {
        ...vendor,
        organizationId,
        createdAt: new Date().toISOString()
      });
    }

    // 4. Seed Compliance/Audit Readiness
    const complianceItems = [
      { name: 'NYDFS Part 500', description: 'NY Cybersecurity Regulation for Financial Services', progress: 88, status: 'Compliant', nextAudit: '2026-12-31' },
      { name: 'NAIC Data Security', description: 'NAIC Model Law 668', progress: 72, status: 'In Progress', nextAudit: '2026-11-15' },
      { name: 'ISO 27001:2022', description: 'Information Security Management System', progress: 95, status: 'Compliant', nextAudit: '2026-10-01' },
      { name: 'SOC 2 Type II', description: 'Trust Services Criteria', progress: 82, status: 'In Progress', nextAudit: '2026-09-20' },
    ];

    for (const comp of complianceItems) {
      await addDoc(collection(db, 'compliance'), {
        ...comp,
        organizationId,
        createdAt: new Date().toISOString()
      });
    }

    // 5. Seed Incidents
    const incidents = [
      {
        title: "Suspicious login attempt from unauthorized region",
        severity: "Medium",
        status: "Resolved",
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        reporter: "AWS GuardDuty"
      },
      {
        title: "Potential data exfiltration via unauthorized USB device",
        severity: "High",
        status: "Investigating",
        date: new Date(Date.now() - 86400000).toISOString(),
        reporter: "CrowdStrike"
      }
    ];

    for (const incident of incidents) {
      await addDoc(collection(db, 'incidents'), {
        ...incident,
        organizationId,
        createdAt: new Date().toISOString()
      });
    }

    // 5. Seed Compliance/Audit Readiness
    for (const frameworkId of frameworks) {
      const frameworkName = frameworkId.toUpperCase();
      await addDoc(collection(db, 'audit_readiness'), {
        framework: frameworkName,
        readinessScore: 65 + Math.floor(Math.random() * 20),
        status: "Near Ready",
        redFlags: ["Missing quarterly internal audit", "Policy version drift"],
        recommendations: ["Update ISMS docs", "Enable MFA for all admin accounts"],
        auditorOpinion: "The organization demonstrates a strong commitment but lacks periodic verification evidence.",
        organizationId,
        createdAt: new Date().toISOString()
      });
    }

    // 6. Seed Connectors
    const connectors = [
      { name: "Main AWS Account", type: "AWS", status: "Connected", findings: 12, health: 88 },
      { name: "Engineering Organization", type: "GitHub", status: "Connected", findings: 4, health: 95 },
      { name: "Corporate Identity", type: "Okta", status: "Connected", findings: 0, health: 100 }
    ];

    for (const conn of connectors) {
      await addDoc(collection(db, 'connectors'), {
        ...conn,
        organizationId,
        createdAt: new Date().toISOString()
      });
    }

    // 7. Seed Calendar Events
    const events = [
      {
        title: "Internal ISMS Review",
        startDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        type: "Internal Review",
        description: "Quarterly review of current security controls and policies."
      },
      {
        title: "SOC 2 Type II External Audit",
        startDate: new Date(Date.now() + 86400000 * 20).toISOString(),
        type: "External Audit",
        description: "Main compliance audit window."
      }
    ];

    for (const event of events) {
      await addDoc(collection(db, 'calendar_events'), {
        ...event,
        organizationId,
        createdAt: new Date().toISOString()
      });
    }

    // 8. Seed Identities (Identity Risk Surface)
    const identities = [
      {
        name: "Devon Lane",
        email: "devon@nexusgrc.io",
        device: "MacBook Pro M3",
        accessLevel: 'Global Admin',
        dataSensitivity: 'Level 5 (PII, Financials)',
        deviceHealth: 100,
        riskScore: 5,
        lastAudit: new Date().toISOString(),
        organizationId
      },
      {
        name: "Sarah Chen",
        email: "sarah@nexusgrc.io",
        device: "Windows 11 Surface",
        accessLevel: 'Developer',
        dataSensitivity: 'Level 4 (Source Code)',
        deviceHealth: 75,
        riskScore: 42,
        lastAudit: new Date(Date.now() - 3600000).toISOString(),
        organizationId
      },
      {
        name: "Marcus Thorne",
        email: "marcus@nexusgrc.io",
        device: "iPhone 15 Pro",
        accessLevel: 'Sales Ops',
        dataSensitivity: 'Level 3 (CRM, Contacts)',
        deviceHealth: 60,
        riskScore: 68,
        lastAudit: new Date(Date.now() - 86400000).toISOString(),
        organizationId
      }
    ];

    for (const identity of identities) {
      await addDoc(collection(db, 'identities'), identity);
    }

    return true;
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}
