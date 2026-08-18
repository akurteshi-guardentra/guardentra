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
        title: "Incomplete vendor questionnaire coverage",
        category: "Third-Party Risk",
        severity: "Critical",
        status: "Open",
        impact: 5,
        likelihood: 3,
        mitigation: "Send GuardEntra-authored assessment packs and review unanswered items weekly.",
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
        title: "Missing questionnaire evidence for high-impact vendors",
        category: "Third-Party Risk",
        severity: "High",
        status: "In Progress",
        impact: 4,
        likelihood: 3,
        mitigation: "Collect vendor answers and supporting files through the assessment portal.",
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
        category: "Governance",
        status: "Active",
        version: "1.0",
        content: "# Cybersecurity Asset Management Policy\nThis sample policy defines requirements for maintaining an inventory of information assets.",
      },
      {
        title: "Incident Response Plan",
        category: "Operations",
        status: "Active",
        version: "2.1",
        content: "# Incident Response Plan\nSample steps during a security incident: 1. Identification, 2. Containment. This is sample text, not a publisher standard.",
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
        reputation: "Sample claims-management vendor for questionnaire workflow testing."
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
      { name: 'NIST CSF 2.0', description: 'GuardEntra-authored assessment pack (NIST CSF 2.0-labelled).', progress: 0, status: 'In Progress', nextAudit: '2026-12-31' },
      { name: 'ISO 27001:2022', description: 'GuardEntra-authored assessment pack (ISO 27001-labelled).', progress: 0, status: 'In Progress', nextAudit: '2026-11-15' },
      { name: 'SOC 2', description: 'GuardEntra-authored assessment pack (SOC 2-labelled).', progress: 0, status: 'In Progress', nextAudit: '2026-10-01' },
      { name: 'HIPAA', description: 'GuardEntra-authored assessment pack (HIPAA-labelled).', progress: 0, status: 'In Progress', nextAudit: '2026-09-20' },
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
      const frameworkName =
        frameworkId === 'nist_csf_2'
          ? 'NIST CSF 2.0'
          : frameworkId === 'iso27001'
            ? 'ISO 27001:2022'
            : frameworkId === 'soc2'
              ? 'SOC 2'
              : String(frameworkId).toUpperCase();
      await addDoc(collection(db, 'audit_readiness'), {
        framework: frameworkName,
        frameworkId,
        readinessScore: 65 + Math.floor(Math.random() * 20),
        status: "Near Ready",
        redFlags: ["Missing quarterly internal audit", "Policy version drift"],
        recommendations: ["Update ISMS docs", "Enable MFA for all admin accounts"],
        auditorOpinion: "Sample readiness note for demo tenants. Not an auditor opinion or compliance determination.",
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
        title: "Sample questionnaire review window",
        startDate: new Date(Date.now() + 86400000 * 20).toISOString(),
        type: "Internal Review",
        description: "Sample reminder to review vendor questionnaire answers."
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
        email: "devon@guardentra.com",
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
        email: "sarah@guardentra.com",
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
        email: "marcus@guardentra.com",
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
