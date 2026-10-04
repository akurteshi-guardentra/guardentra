import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const trustDir = path.join(root, 'docs', 'trust');
const readiness = JSON.parse(
  fs.readFileSync(path.join(trustDir, 'CUSTOMER_TRUST_READINESS.json'), 'utf8'),
);

describe('#119 customer trust readiness contract', () => {
  it('fails closed until counsel/public evidence exists', () => {
    expect(readiness.schema).toBe('guardentra.customer_trust_readiness.v1');
    expect(readiness.production_ready).toBe(false);
    for (const key of [
      'privacy_notice',
      'terms_of_service',
      'data_processing_agreement',
      'subprocessor_disclosure',
      'international_transfers',
      'retention_and_deletion_terms',
      'incident_notification_terms',
    ]) {
      expect(readiness.legal_gates[key].status).toBe('PENDING_COUNSEL');
    }
  });

  it('does not represent planned email infrastructure as active', () => {
    const byService = new Map<string, any>(readiness.service_register.map((row: any) => [row.service, row]));
    expect(byService.get('SendGrid / SMTP provider')?.runtime_status).toBe('PLANNED_STAGING');
    expect(byService.get('Firebase Trigger Email managed extension')?.runtime_status).toBe('UNVERIFIED_STAGING');
  });

  it('keeps legal service classification pending instead of inventing subprocessor conclusions', () => {
    for (const row of readiness.service_register) {
      expect(row.legal_classification).toBe('PENDING_COUNSEL');
      expect(Array.isArray(row.evidence)).toBe(true);
      expect(row.evidence.length).toBeGreaterThan(0);
    }
  });

  it('keeps current technical release limitations explicit', () => {
    const security = fs.readFileSync(path.join(trustDir, 'SECURITY_OVERVIEW.md'), 'utf8');
    expect(security).toMatch(/Invitation email delivery \(#72\)/);
    expect(security).toMatch(/Production malware scanning \(#73\)/);
    expect(security).toMatch(/Audit spine \(#74\)/);
    expect(security).toMatch(/not a certification/i);
  });

  it('requires legal/public evidence before production readiness points', () => {
    const legal = fs.readFileSync(path.join(trustDir, 'LEGAL_RELEASE_CHECKLIST.md'), 'utf8');
    expect(legal).toMatch(/not legal advice/i);
    expect(legal).toMatch(/production_verified/);
    expect(legal).toMatch(/Draft docs or this checklist alone.*not.*production-live readiness/is);
  });

  it('does not contain unsupported certification assertions', () => {
    const security = fs.readFileSync(path.join(trustDir, 'SECURITY_OVERVIEW.md'), 'utf8');
    expect(security).not.toMatch(/GuardEntra (is|is currently) (SOC 2|ISO 27001|FedRAMP)/i);
    expect(security).toMatch(/must not state or imply.*SOC 2 certified/is);
  });
});
