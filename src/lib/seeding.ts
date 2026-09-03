import {
  collection,
  doc,
  getDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { db } from '../firebase';

/** Explicit sample-seed schema version — bump only when sample payload intentionally changes. */
export const SAMPLE_SEED_VERSION = 'v1';

export interface SeedOptions {
  organizationId: string;
  industry: string;
  frameworks: string[];
  /** Injected for tests; defaults to app Firestore. */
  firestore?: Firestore;
}

export interface SeedResult {
  skipped: boolean;
  reason?: 'already_seeded';
  /** Number of writeBatch.commit() network mutation phases. */
  batchCommits: number;
  /** Number of documents written in this run (0 when skipped). */
  writeCount: number;
  durationMs: number;
  sampleSeedVersion: typeof SAMPLE_SEED_VERSION;
}

/** Deterministic sample document id scoped to org + seed version + stable slug. */
export function sampleDocId(
  organizationId: string,
  collectionName: string,
  slug: string,
  version: string = SAMPLE_SEED_VERSION
): string {
  const safeOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `${safeOrg}__sample_${version}__${collectionName}__${safeSlug}`;
}

/** Deterministic compliance doc for an onboarding-selected framework. */
export function frameworkComplianceDocId(organizationId: string, frameworkId: string): string {
  const safeOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFw = frameworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeOrg}__fw__${safeFw}`;
}

function frameworkDisplayName(frameworkId: string): string {
  if (frameworkId === 'nist_csf_2') return 'NIST CSF 2.0';
  if (frameworkId === 'iso27001') return 'ISO 27001:2022';
  if (frameworkId === 'soc2') return 'SOC 2';
  if (frameworkId === 'hipaa') return 'HIPAA';
  return String(frameworkId).toUpperCase();
}

/**
 * Build the full sample workspace payload. Pure — no network I/O.
 * Each record includes `isSample: true` and `sampleSeedVersion` so customer data is never overwritten by slug collision alone (IDs are also deterministic and sample-prefixed).
 */
export function buildSampleSeedRecords(options: SeedOptions): Array<{
  collection: string;
  id: string;
  data: Record<string, unknown>;
}> {
  const { organizationId, frameworks } = options;
  const now = new Date().toISOString();
  const records: Array<{ collection: string; id: string; data: Record<string, unknown> }> = [];

  const risks = [
    {
      slug: 'incomplete-vendor-questionnaire',
      title: 'Incomplete vendor questionnaire coverage',
      category: 'Third-Party Risk',
      severity: 'Critical',
      status: 'Open',
      impact: 5,
      likelihood: 3,
      mitigation: 'Send GuardEntra-authored assessment packs and review unanswered items weekly.',
    },
    {
      slug: 'inadequate-vendor-risk-program',
      title: 'Inadequate vendor risk management program',
      category: 'Third-Party Risk',
      severity: 'High',
      status: 'Open',
      impact: 4,
      likelihood: 4,
      mitigation: 'Implement automated vendor assessment workflows and quarterly reviews.',
    },
    {
      slug: 'unencrypted-pii-dev',
      title: 'Unencrypted PII discovered in development environments',
      category: 'Data Privacy',
      severity: 'High',
      status: 'Mitigated',
      impact: 5,
      likelihood: 2,
      mitigation: 'Deployed data masking scripts and updated developer security training.',
    },
    {
      slug: 'missing-questionnaire-evidence',
      title: 'Missing questionnaire evidence for high-impact vendors',
      category: 'Third-Party Risk',
      severity: 'High',
      status: 'In Progress',
      impact: 4,
      likelihood: 3,
      mitigation: 'Collect vendor answers and supporting files through the assessment portal.',
    },
  ];
  for (const risk of risks) {
    const { slug, ...fields } = risk;
    records.push({
      collection: 'risks',
      id: sampleDocId(organizationId, 'risks', slug),
      data: {
        ...fields,
        owner: 'System Audit',
        organizationId,
        createdAt: now,
        isSample: true,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      },
    });
  }

  const policies = [
    {
      slug: 'asset-management',
      title: 'Cybersecurity Asset Management Policy',
      category: 'Governance',
      status: 'Active',
      version: '1.0',
      content:
        '# Cybersecurity Asset Management Policy\nThis sample policy defines requirements for maintaining an inventory of information assets.',
    },
    {
      slug: 'incident-response',
      title: 'Incident Response Plan',
      category: 'Operations',
      status: 'Active',
      version: '2.1',
      content:
        '# Incident Response Plan\nSample steps during a security incident: 1. Identification, 2. Containment. This is sample text, not a publisher standard.',
    },
    {
      slug: 'acceptable-use',
      title: 'Acceptable Use Policy',
      category: 'Governance',
      status: 'Active',
      version: '1.2',
      content:
        '# Acceptable Use Policy\nGuidelines for the proper use of company assets and intellectual property...',
    },
  ];
  for (const policy of policies) {
    const { slug, ...fields } = policy;
    records.push({
      collection: 'policies',
      id: sampleDocId(organizationId, 'policies', slug),
      data: {
        ...fields,
        organizationId,
        createdAt: now,
        updatedAt: now,
        isSample: true,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      },
    });
  }

  const vendors = [
    {
      slug: 'guidewire-cloud',
      name: 'Guidewire Cloud',
      category: 'Policy Administration',
      criticality: 'Critical',
      status: 'Active',
      riskScore: 85,
      reputation: 'Industry standard for insurance core systems.',
    },
    {
      slug: 'snapsheet',
      name: 'Snapsheet',
      category: 'Claims Processing',
      criticality: 'High',
      status: 'Active',
      riskScore: 92,
      reputation: 'Sample claims-management vendor for questionnaire workflow testing.',
    },
    {
      slug: 'aws',
      name: 'Amazon Web Services (AWS)',
      category: 'Infrastructure',
      criticality: 'Critical',
      status: 'Active',
      riskScore: 98,
      reputation: 'Hosting core insurance workloads.',
    },
  ];
  for (const vendor of vendors) {
    const { slug, ...fields } = vendor;
    records.push({
      collection: 'vendors',
      id: sampleDocId(organizationId, 'vendors', slug),
      data: {
        ...fields,
        organizationId,
        createdAt: now,
        isSample: true,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      },
    });
  }

  const complianceItems = [
    {
      slug: 'nist-csf-2',
      name: 'NIST CSF 2.0',
      description: 'GuardEntra-authored assessment pack (NIST CSF 2.0-labelled).',
      progress: 0,
      status: 'In Progress',
      nextAudit: '2026-12-31',
    },
    {
      slug: 'iso27001',
      name: 'ISO 27001:2022',
      description: 'GuardEntra-authored assessment pack (ISO 27001-labelled).',
      progress: 0,
      status: 'In Progress',
      nextAudit: '2026-11-15',
    },
    {
      slug: 'soc2',
      name: 'SOC 2',
      description: 'GuardEntra-authored assessment pack (SOC 2-labelled).',
      progress: 0,
      status: 'In Progress',
      nextAudit: '2026-10-01',
    },
    {
      slug: 'hipaa',
      name: 'HIPAA',
      description: 'GuardEntra-authored assessment pack (HIPAA-labelled).',
      progress: 0,
      status: 'In Progress',
      nextAudit: '2026-09-20',
    },
  ];
  for (const comp of complianceItems) {
    const { slug, ...fields } = comp;
    records.push({
      collection: 'compliance',
      id: sampleDocId(organizationId, 'compliance', slug),
      data: {
        ...fields,
        organizationId,
        createdAt: now,
        isSample: true,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      },
    });
  }

  const incidents = [
    {
      slug: 'suspicious-login',
      title: 'Suspicious login attempt from unauthorized region',
      severity: 'Medium',
      status: 'Resolved',
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      reporter: 'AWS GuardDuty',
    },
    {
      slug: 'usb-exfiltration',
      title: 'Potential data exfiltration via unauthorized USB device',
      severity: 'High',
      status: 'Investigating',
      date: new Date(Date.now() - 86400000).toISOString(),
      reporter: 'CrowdStrike',
    },
  ];
  for (const incident of incidents) {
    const { slug, ...fields } = incident;
    records.push({
      collection: 'incidents',
      id: sampleDocId(organizationId, 'incidents', slug),
      data: {
        ...fields,
        organizationId,
        createdAt: now,
        isSample: true,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      },
    });
  }

  for (const frameworkId of frameworks) {
    records.push({
      collection: 'audit_readiness',
      id: sampleDocId(organizationId, 'audit_readiness', frameworkId),
      data: {
        framework: frameworkDisplayName(frameworkId),
        frameworkId,
        // Deterministic demo score (no Math.random) so retries stay identical.
        readinessScore: 72,
        status: 'Near Ready',
        redFlags: ['Missing quarterly internal audit', 'Policy version drift'],
        recommendations: ['Update ISMS docs', 'Enable MFA for all admin accounts'],
        auditorOpinion:
          'Sample readiness note for demo tenants. Not an auditor opinion or compliance determination.',
        organizationId,
        createdAt: now,
        isSample: true,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      },
    });
  }

  const connectors = [
    { slug: 'main-aws', name: 'Main AWS Account', type: 'AWS', status: 'Connected', findings: 12, health: 88 },
    {
      slug: 'engineering-github',
      name: 'Engineering Organization',
      type: 'GitHub',
      status: 'Connected',
      findings: 4,
      health: 95,
    },
    { slug: 'corporate-okta', name: 'Corporate Identity', type: 'Okta', status: 'Connected', findings: 0, health: 100 },
  ];
  for (const conn of connectors) {
    const { slug, ...fields } = conn;
    records.push({
      collection: 'connectors',
      id: sampleDocId(organizationId, 'connectors', slug),
      data: {
        ...fields,
        organizationId,
        createdAt: now,
        isSample: true,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      },
    });
  }

  const events = [
    {
      slug: 'isms-review',
      title: 'Internal ISMS Review',
      startDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      type: 'Internal Review',
      description: 'Quarterly review of current security controls and policies.',
    },
    {
      slug: 'questionnaire-review',
      title: 'Sample questionnaire review window',
      startDate: new Date(Date.now() + 86400000 * 20).toISOString(),
      type: 'Internal Review',
      description: 'Sample reminder to review vendor questionnaire answers.',
    },
  ];
  for (const event of events) {
    const { slug, ...fields } = event;
    records.push({
      collection: 'calendar_events',
      id: sampleDocId(organizationId, 'calendar_events', slug),
      data: {
        ...fields,
        organizationId,
        createdAt: now,
        isSample: true,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      },
    });
  }

  const identities = [
    {
      slug: 'devon-lane',
      name: 'Devon Lane',
      email: 'devon@guardentra.com',
      device: 'MacBook Pro M3',
      accessLevel: 'Global Admin',
      dataSensitivity: 'Level 5 (PII, Financials)',
      deviceHealth: 100,
      riskScore: 5,
      lastAudit: now,
    },
    {
      slug: 'sarah-chen',
      name: 'Sarah Chen',
      email: 'sarah@guardentra.com',
      device: 'Windows 11 Surface',
      accessLevel: 'Developer',
      dataSensitivity: 'Level 4 (Source Code)',
      deviceHealth: 75,
      riskScore: 42,
      lastAudit: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      slug: 'marcus-thorne',
      name: 'Marcus Thorne',
      email: 'marcus@guardentra.com',
      device: 'iPhone 15 Pro',
      accessLevel: 'Sales Ops',
      dataSensitivity: 'Level 3 (CRM, Contacts)',
      deviceHealth: 60,
      riskScore: 68,
      lastAudit: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
  for (const identity of identities) {
    const { slug, ...fields } = identity;
    records.push({
      collection: 'identities',
      id: sampleDocId(organizationId, 'identities', slug),
      data: {
        ...fields,
        organizationId,
        isSample: true,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      },
    });
  }

  return records;
}

const FIRESTORE_BATCH_LIMIT = 450; // stay safely under 500

/**
 * Seed demo workspace data with:
 * - org-level `sampleSeedVersion` marker for skip-on-retry
 * - deterministic document IDs (set, not add) so retries do not duplicate
 * - batched writes (few network commits) instead of sequential addDoc awaits
 *
 * Does not overwrite non-sample customer records: IDs are sample-prefixed and
 * scoped to organizationId + SAMPLE_SEED_VERSION.
 */
export async function seedProfessionalData(options: SeedOptions): Promise<SeedResult> {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const firestore = options.firestore ?? db;
  const { organizationId } = options;

  try {
    const orgRef = doc(firestore, 'organizations', organizationId);
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists() && orgSnap.data()?.sampleSeedVersion === SAMPLE_SEED_VERSION) {
      const durationMs = Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started
      );
      if (import.meta.env.DEV) {
        console.info('sample_seed_duration_ms', durationMs, { skipped: true, sampleSeedVersion: SAMPLE_SEED_VERSION });
      }
      return {
        skipped: true,
        reason: 'already_seeded',
        batchCommits: 0,
        writeCount: 0,
        durationMs,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      };
    }

    const records = buildSampleSeedRecords(options);
    let batchCommits = 0;
    let writeCount = 0;

    for (let i = 0; i < records.length; i += FIRESTORE_BATCH_LIMIT) {
      const slice = records.slice(i, i + FIRESTORE_BATCH_LIMIT);
      const batch = writeBatch(firestore);
      for (const record of slice) {
        const ref = doc(collection(firestore, record.collection), record.id);
        batch.set(ref, record.data);
        writeCount += 1;
      }
      // Persist the org marker in the final batch so a partial earlier commit
      // can still be completed/idempotently retried via deterministic IDs.
      if (i + FIRESTORE_BATCH_LIMIT >= records.length) {
        batch.set(
          orgRef,
          {
            sampleSeedVersion: SAMPLE_SEED_VERSION,
            sampleSeededAt: new Date().toISOString(),
          },
          { merge: true }
        );
        writeCount += 1;
      }
      await batch.commit();
      batchCommits += 1;
    }

    const durationMs = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started
    );
    if (import.meta.env.DEV) {
      console.info('sample_seed_duration_ms', durationMs, {
        skipped: false,
        batchCommits,
        writeCount,
        sampleSeedVersion: SAMPLE_SEED_VERSION,
      });
    }

    return {
      skipped: false,
      batchCommits,
      writeCount,
      durationMs,
      sampleSeedVersion: SAMPLE_SEED_VERSION,
    };
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}
