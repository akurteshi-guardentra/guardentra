# GuardEntra production scanner evidence template

Use this template for Issue #73 production-scanner work. The existing static manifest
gate can prove configuration shape only; it explicitly does **not** prove a live
production scanner.

This document grants **no** production mutation authority.

## Hard boundaries

- Environment must be `production`.
- Project must be `guardentra-prod`.
- Re-read protected `main` immediately before evidence collection and record the exact SHA.
- A green `guardentra.production_scanner_manifest_gate.v1` result is prerequisite
  evidence only; `live_proof` remains `false` until production acceptance succeeds.
- Never record secret payloads, access tokens, ID tokens, private keys, raw auth output,
  provider prompts, customer evidence content, or malware sample bytes.
- Secret evidence is limited to secret **name/reference**, version state where readable,
  and IAM principal/role names.
- Do not use customer uploads for clean/EICAR acceptance.
- `MERGED != PRODUCTION_LIVE_VERIFIED`.

## Result vocabulary

| Result | Meaning |
|---|---|
| `PASS` | Direct evidence supports the expected production fact. |
| `PARTIAL` | Some evidence exists, but a required layer is not independently proven. |
| `BLOCKED` | Observation/action cannot safely proceed with the available authority/tooling. |
| `FAIL` | Direct evidence contradicts the expected production fact. |

## Read-only production inventory record

Persist a JSON record using this shape. Use `null` for unavailable optional values;
do not invent values.

```json
{
  "schema": "guardentra.production_scanner_inventory.v1",
  "observed_utc": "<RFC3339 UTC>",
  "environment": "production",
  "project_id": "guardentra-prod",
  "repository": "akurteshi-guardentra/guardentra",
  "repository_sha": "<40-hex protected main SHA>",
  "collector": {
    "agent_tool": "<actual tool/process used>",
    "principal": "<authenticated principal name only>",
    "runner": "<approved local/cloud runner identity or null>"
  },
  "overall_result": "PASS|PARTIAL|BLOCKED|FAIL",
  "static_manifest_gate": {
    "schema": "guardentra.production_scanner_manifest_gate.v1",
    "state": "disabled|invalid_partial|config_ready|invalid_activation",
    "pass": false,
    "live_proof": false,
    "source_file": "apphosting.prod.yaml",
    "source_sha": "<repository SHA>"
  },
  "app_hosting": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "backend": null,
    "region": null,
    "build_id": null,
    "rollout_id": null,
    "revision": null,
    "source_sha": null,
    "runtime_service_account": null,
    "health_status": null,
    "scanner_enabled": null,
    "scanner_delivery": null,
    "scanner_secret_reference_present": null,
    "source": null
  },
  "cloud_tasks": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "project": "guardentra-prod",
    "location": null,
    "queue": null,
    "state": null,
    "target_url": null,
    "audience": null,
    "task_service_account": null,
    "retry_rate_summary": null,
    "source": null
  },
  "clamav": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "runtime_identity": null,
    "region": null,
    "host_reference": null,
    "port": null,
    "private_network_path": null,
    "health_status": null,
    "signature_version": null,
    "source": null
  },
  "network": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "vpc": null,
    "subnet": null,
    "private_connectivity": null,
    "app_hosting_egress": null,
    "source": null
  },
  "secrets": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "references": [
      {
        "name": "EVIDENCE_SCANNER_SECRET",
        "referenced_by_runtime": null,
        "version_state": null,
        "iam_principals_roles": [],
        "source": null
      }
    ],
    "secret_payloads_read": false
  },
  "iam": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "app_runtime_service_account": null,
    "task_service_account": null,
    "roles": [],
    "unexpected_privileged_bindings": [],
    "source": null
  },
  "rollback_baseline": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "build_id": null,
    "rollout_id": null,
    "revision": null,
    "source_sha": null,
    "scanner_enabled": null,
    "queue_state": null,
    "source": null
  },
  "blockers": [
    {
      "component": null,
      "classification": null,
      "detail_redacted": null,
      "source": null
    }
  ]
}
```

## Inventory reconciliation checks

Before any production provisioning/configuration packet may be prepared:

1. `environment` is exactly `production` and `project_id` exactly
   `guardentra-prod`.
2. `repository_sha` is exact 40-hex and still equals protected `main`.
3. The static manifest gate is run against the exact source file/SHA and its
   `live_proof` remains `false`.
4. Production App Hosting live build/revision/source and runtime service account are
   observed directly; repository YAML alone is insufficient.
5. If the scanner is already partially present, every active component is inventoried
   before change planning. Access denial is `BLOCKED`, not proof of absence.
6. Cloud Tasks project/location/queue/target/audience/task SA are observed directly.
   Target URL and audience are recorded separately and must match the intended live
   worker contract.
7. ClamAV host/port/runtime/network path are observed directly; private addressing
   requires the expected private VPC path.
8. Secret evidence proves reference/access metadata only;
   `secret_payloads_read` remains `false`.
9. Runtime/task identities and role names are recorded for least-privilege review.
10. A rollback baseline identifies the currently serving production build/revision,
    scanner flag, queue state and source SHA before any production-affecting change.

## Separately authorized production acceptance record

The inventory above is **not** production-live proof. After a separately scoped,
Owner-authorized production change/release packet is executed, create a second record:

```json
{
  "schema": "guardentra.production_scanner_acceptance.v1",
  "observed_utc": "<RFC3339 UTC>",
  "environment": "production",
  "project_id": "guardentra-prod",
  "repository_sha": "<exact released SHA>",
  "build_id": "<live build>",
  "rollout_id": "<live rollout>",
  "revision": "<live revision>",
  "overall_result": "PASS|PARTIAL|BLOCKED|FAIL",
  "tests": {
    "health_readback": "PASS|PARTIAL|BLOCKED|FAIL",
    "clean_fixture": "PASS|PARTIAL|BLOCKED|FAIL",
    "eicar_fixture": "PASS|PARTIAL|BLOCKED|FAIL",
    "generation_binding": "PASS|PARTIAL|BLOCKED|FAIL",
    "deterministic_task_identity": "PASS|PARTIAL|BLOCKED|FAIL",
    "retry_idempotency": "PASS|PARTIAL|BLOCKED|FAIL",
    "timeout_fail_closed": "PASS|PARTIAL|BLOCKED|FAIL",
    "scanner_error_fail_closed": "PASS|PARTIAL|BLOCKED|FAIL",
    "queue_recovery": "PASS|PARTIAL|BLOCKED|FAIL",
    "monitoring_observable": "PASS|PARTIAL|BLOCKED|FAIL",
    "rollback_ready": "PASS|PARTIAL|BLOCKED|FAIL"
  },
  "clean": {
    "fixture_id": "<synthetic fixture identifier>",
    "verdict": null,
    "scanner": "ClamAV",
    "source": null
  },
  "eicar": {
    "fixture_id": "<synthetic EICAR fixture identifier>",
    "verdict": null,
    "signature": "Eicar-Test-Signature",
    "source": null
  },
  "fail_closed": {
    "timeout_result": null,
    "scanner_error_result": null,
    "no_false_clean": null,
    "source": null
  },
  "rollback": {
    "baseline": null,
    "procedure_verified": null,
    "readback": null,
    "source": null
  },
  "customer_data_used": false,
  "secret_payloads_read": false,
  "blockers": []
}
```

### Production acceptance invariants

- Use only synthetic Owner-controlled clean/EICAR fixtures.
- A timeout, unreachable scanner, invalid scanner response, or worker failure must never
  become a false `clean` verdict.
- Prove queue/task identity and retry behavior do not duplicate the logical scan.
- Prove the object generation/version associated with the verdict is the one requested.
- Record the live build/revision/source SHA used for every acceptance result.
- Record monitoring/log evidence without customer data or secret-bearing payloads.
- Preserve the pre-change rollback baseline and perform/read back rollback if the release
  gate requires it.
- Do not claim `PRODUCTION_LIVE_VERIFIED` from static config, queue creation, deployment
  success, or a clean fixture alone. All required acceptance dimensions must be evidenced.
