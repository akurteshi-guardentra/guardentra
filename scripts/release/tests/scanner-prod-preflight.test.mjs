import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { evaluateProductionScannerManifest } from '../scanner-prod-preflight.mjs';

test('current production manifest is safely disabled, not falsely live', () => {
  const text = fs.readFileSync('apphosting.prod.yaml', 'utf8');
  const result = evaluateProductionScannerManifest(text);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'disabled');
  assert.equal(result.liveProof, false);
});

const ready = `
runConfig:
  vpcAccess:
    egress: PRIVATE_RANGES_ONLY
    networkInterfaces:
      - network: default
        subnetwork: default

env:
  - variable: APP_ENV
    value: production
    availability:
      - RUNTIME
  - variable: EVIDENCE_SCANNER_ENABLED
    value: "true"
    availability:
      - RUNTIME
  - variable: EVIDENCE_SCANNER_SECRET
    secret: EVIDENCE_SCANNER_SECRET
    availability:
      - RUNTIME
  - variable: CLAMAV_HOST
    value: "10.20.0.2"
    availability:
      - RUNTIME
  - variable: CLAMAV_PORT
    value: "3310"
    availability:
      - RUNTIME
  - variable: EVIDENCE_SCANNER_DELIVERY
    value: cloud_tasks
    availability:
      - RUNTIME
  - variable: EVIDENCE_SCANNER_TASK_PROJECT
    value: guardentra-prod
    availability:
      - RUNTIME
  - variable: EVIDENCE_SCANNER_TASK_LOCATION
    value: us-central1
    availability:
      - RUNTIME
  - variable: EVIDENCE_SCANNER_TASK_QUEUE
    value: evidence-malware-scan
    availability:
      - RUNTIME
  - variable: EVIDENCE_SCANNER_TASK_TARGET_URL
    value: https://guardentra-prod.example/api/internal/evidence-scan-task
    availability:
      - RUNTIME
  - variable: EVIDENCE_SCANNER_TASK_AUDIENCE
    value: https://guardentra-prod.example/api/internal/evidence-scan-task
    availability:
      - RUNTIME
  - variable: EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT
    value: evidence-scan-task@guardentra-prod.iam.gserviceaccount.com
    availability:
      - RUNTIME
`;

test('complete production manifest reaches config_ready but never live proof', () => {
  const result = evaluateProductionScannerManifest(ready);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'config_ready');
  assert.equal(result.liveProof, false);
});

test('partial activation fails closed', () => {
  const result = evaluateProductionScannerManifest(`
env:
  - variable: APP_ENV
    value: production
  - variable: CLAMAV_HOST
    value: 10.20.0.2
`);
  assert.equal(result.ok, false);
  assert.equal(result.state, 'invalid_partial');
});

test('literal scanner secret is refused', () => {
  const result = evaluateProductionScannerManifest(
    ready.replace('secret: EVIDENCE_SCANNER_SECRET', 'value: plaintext-secret'),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Secret Manager reference/);
});

test('test-only scanner mode is refused in production manifest', () => {
  const result = evaluateProductionScannerManifest(
    ready + `
  - variable: EVIDENCE_SCANNER_MODE
    value: eicar_only
`,
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /must not be set/);
});

test('cross-project task identity is refused', () => {
  const result = evaluateProductionScannerManifest(
    ready.replaceAll('guardentra-prod', 'guardentra-staging'),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /TASK_PROJECT|service account/);
});

test('private ClamAV address requires VPC config', () => {
  const result = evaluateProductionScannerManifest(
    ready.replace(/runConfig:[\s\S]*?env:/, 'env:'),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /VPC access/);
});
