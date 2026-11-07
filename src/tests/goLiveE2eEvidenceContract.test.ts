import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Step = { id: string; result: string; source: string | null; detail_redacted: string | null };

const root = process.cwd();
const templatePath = path.join(root, 'docs', 'release', 'GO_LIVE_E2E_EVIDENCE_TEMPLATE.json');

function readTemplate() {
  return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
}

describe('#124 go-live E2E evidence contract', () => {
  it('binds evidence to exact repository/environment lifecycle fields', () => {
    const doc = readTemplate();
    expect(doc.schema).toBe('guardentra.go_live_e2e.v1');
    expect(doc.repository).toBe('akurteshi-guardentra/guardentra');
    expect(doc).toHaveProperty('repository_sha');
    expect(doc).toHaveProperty('observed_utc');
    expect(doc.staging.project_id).toBe('guardentra-staging');
    expect(doc.production.project_id).toBe('guardentra-prod');
    expect(doc.staging).toHaveProperty('build_id');
    expect(doc.staging).toHaveProperty('revision');
    expect(doc.staging).toHaveProperty('source_sha');
    expect(doc.production).toHaveProperty('rollback_baseline');
    expect(doc.production).toHaveProperty('build_id');
    expect(doc.production).toHaveProperty('revision');
    expect(doc.production).toHaveProperty('source_sha');
    expect(doc.prerequisites.issue_126_legacy_rollout_integrity_resolved).toBe(false);
  });

  it('requires the full staging customer journey and release-critical controls', () => {
    const ids = new Set((readTemplate().staging.steps as Step[]).map((s) => s.id));
    for (const id of [
      'tenant_bootstrap',
      'vendor_create',
      'assessment_create',
      'invitation_queue',
      'provider_acceptance',
      'inbox_receipt',
      'portal_open',
      'answers_persist_reload',
      'clean_evidence_scan',
      'eicar_quarantine',
      'assessment_submit',
      'decision_residual_risk_remediation',
      'decision_packet_export',
      'audit_chain_verify',
      'relogin_persistence',
      'health_cleanup',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('requires production drift, rollback, deploy, health, smoke, isolation and cleanup evidence', () => {
    const ids = new Set((readTemplate().production.steps as Step[]).map((s) => s.id));
    for (const id of [
      'release_sha_drift_check',
      'config_drift_check',
      'rollback_baseline',
      'approved_deploy',
      'health_readback',
      'bounded_smoke_e2e',
      'environment_isolation',
      'cleanup',
      'readiness_recalculation',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('defaults to fail-closed and forbids unsafe evidence shortcuts', () => {
    const doc = readTemplate();
    expect(doc.final_classification).toBe('NOT_READY');
    expect(doc.staging.overall_result).toBe('BLOCKED');
    expect(doc.production.overall_result).toBe('BLOCKED');
    expect(doc.staging.steps.every((s: Step) => s.result === 'BLOCKED')).toBe(true);
    expect(doc.production.steps.every((s: Step) => s.result === 'BLOCKED')).toBe(true);
    expect(doc.invariants).toEqual({
      secret_values_recorded: false,
      customer_data_recorded: false,
      direct_main_write: false,
      force_push: false,
      ad_hoc_deploy_path: false,
      staging_prod_leakage: false,
    });
  });
});
