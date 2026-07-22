import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function seedTestData(organizationId: string) {
  const risks = [
    { title: 'Public S3 Buckets Detected', severity: 'Critical', category: 'Security', status: 'Open', mitigator: 'DevOps Team' },
    { title: 'Phishing Attacks Rising', severity: 'High', category: 'Compliance', status: 'Mitigated', mitigator: 'IT Security' },
    { title: 'Downtime in EU-West-2', severity: 'Medium', category: 'Operational', status: 'Open', mitigator: 'Platform Eng' },
    { title: 'GDPR Data Subject Access Request backlog', severity: 'Low', category: 'Compliance', status: 'Open', mitigator: 'Legal' }
  ];

  const incidents = [
    { title: 'Unauthorized API Access Attempt', severity: 'High', status: 'Open', category: 'Security', date: new Date().toISOString() },
    { title: 'DDoS Mitigation Triggered', severity: 'Medium', status: 'Investigating', category: 'Network', date: new Date().toISOString() },
    { title: 'Key rotation failure', severity: 'Low', status: 'Open', category: 'Access', date: new Date().toISOString() }
  ];

  const vendors = [
    { name: 'Cloud Provider X', criticality: 'Critical', status: 'Active', contact: 'ops@cloudx.com', riskScore: 92 },
    { name: 'Identity Service Y', criticality: 'High', status: 'Pending', contact: 'security@servicey.com', riskScore: 85 }
  ];

  const connectors = [
    { name: 'AWS Production', type: 'AWS', status: 'Connected', lastScan: new Date().toISOString(), health: 92 },
    { name: 'GitHub Enterprise', type: 'GitHub', status: 'Connected', lastScan: new Date().toISOString(), health: 100 }
  ];

  const calendarEvents = [
    { title: 'ISO 27001 Surveillance Audit', type: 'External Audit', startDate: new Date(Date.now() + 86400000 * 30).toISOString(), status: 'Scheduled' },
    { title: 'Quarterly Risk Review', type: 'Internal Review', startDate: new Date(Date.now() + 86400000 * 7).toISOString(), status: 'Draft' }
  ];

  const policies = [
    { title: 'Acceptable Use Policy', status: 'Active', version: '2.1', category: 'Security', content: '# Acceptable Use Policy\n\nUsers must not use systems for personal gain.' },
    { title: 'Business Continuity Plan', status: 'Draft', version: '1.0', category: 'Operational', content: '# Business Continuity Plan\n\nIn case of outage, proceed to secondary site.' }
  ];

  const auditReadiness = [
    { framework: 'ISO 27001', readinessScore: 84, status: 'Ready', findings: 5, redFlags: ['Missing MFA on critical dev-ops accounts', 'Encryption not enforced on all staging buckets'], createdAt: new Date().toISOString(), auditorOpinion: 'The organization shows maturity but several red flags in DevOps identity management remain.' }
  ];

  const compliance = [
    { name: 'ISO/IEC 27001:2022', description: 'Information Security Management', progress: 84, status: 'Compliant', nextAudit: '2026-10-15' },
    { name: 'SOC 2 Type II', description: 'Service Organization Control', progress: 75, status: 'In Progress', nextAudit: '2026-08-01' },
    { name: 'HIPAA/HITECH', description: 'Health Privacy', progress: 62, status: 'Needs Attention', nextAudit: '2026-12-01' }
  ];

  try {
    const promises = [
      ...risks.map(r => addDoc(collection(db, 'risks'), { ...r, organizationId, createdAt: serverTimestamp() })),
      ...incidents.map(i => addDoc(collection(db, 'incidents'), { ...i, organizationId, createdAt: serverTimestamp() })),
      ...vendors.map(v => addDoc(collection(db, 'vendors'), { ...v, organizationId, createdAt: serverTimestamp() })),
      ...connectors.map(c => addDoc(collection(db, 'connectors'), { ...c, organizationId, createdAt: serverTimestamp() })),
      ...calendarEvents.map(e => addDoc(collection(db, 'calendar_events'), { ...e, organizationId, createdAt: serverTimestamp() })),
      ...policies.map(p => addDoc(collection(db, 'policies'), { ...p, organizationId, createdAt: serverTimestamp() })),
      ...auditReadiness.map(a => addDoc(collection(db, 'audit_readiness'), { ...a, organizationId, createdAt: serverTimestamp() })),
      ...compliance.map(f => addDoc(collection(db, 'compliance'), { ...f, organizationId, createdAt: serverTimestamp() }))
    ];

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}
