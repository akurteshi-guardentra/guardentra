# GuardEntra staging audit-spine evidence template

Use this template only for **read-only evidence collection** for Issue #74 before any
staging audit-spine enablement packet is generated.

This document grants **no** cloud mutation authority.

## Hard boundaries

- Environment must be `staging`.
- Project must be `guardentra-staging`.
- Re-read protected `main` immediately before evidence collection and record the exact SHA.
- Record live runtime identifiers separately from repository state.
- Never record secret payloads, access tokens, ID tokens, private keys, raw auth output,
  provider prompts, customer data, or database credentials.
- Secret evidence is limited to secret **name/reference**, version state where readable,
  and IAM principal/role names.
- A repository value is not proof of a live runtime value.
- `MERGED != STAGING_LIVE_VERIFIED != PRODUCTION_LIVE_VERIFIED`.
- Production is out of scope.

## Result vocabulary

| Result | Meaning |
|---|---|
| `PASS` | Direct read-only evidence supports the expected staging fact. |
| `PARTIAL` | Some evidence exists, but a required field/path is not independently proven. |
| `BLOCKED` | Read-only observation cannot be completed with the available identity/tool. |
| `FAIL` | Direct evidence contradicts the expected staging fact. |

## Machine-readable record

Persist a JSON record using this shape. Use `null` for unavailable optional values;
do not invent values.

```json
{
  "schema": "guardentra.audit_staging_inventory.v1",
  "observed_utc": "<RFC3339 UTC>",
  "environment": "staging",
  "project_id": "guardentra-staging",
  "repository": "akurteshi-guardentra/guardentra",
  "repository_sha": "<40-hex protected main SHA>",
  "collector": {
    "agent_tool": "<actual tool/process used>",
    "principal": "<authenticated principal name only>",
    "runner": "<approved local/cloud runner identity or null>"
  },
  "overall_result": "PASS|PARTIAL|BLOCKED|FAIL",
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
    "audit_spine_enabled": null,
    "audit_worker_enabled": null,
    "audit_database_url_reference_present": null,
    "source": null
  },
  "cloud_sql": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "instance_id": null,
    "region": null,
    "state": null,
    "connection_name": null,
    "public_ip_enabled": null,
    "private_ip_present": null,
    "network_reference": null,
    "backup_ha_maintenance_summary": null,
    "source": null
  },
  "network": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "vpc": null,
    "subnet": null,
    "private_connectivity": null,
    "runtime_egress": null,
    "source": null
  },
  "secrets": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "references": [
      {
        "name": "AUDIT_DATABASE_URL",
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
    "runtime_service_account": null,
    "cloud_sql_roles": [],
    "secret_roles": [],
    "unexpected_privileged_bindings": [],
    "source": null
  },
  "rollback_baseline": {
    "result": "PASS|PARTIAL|BLOCKED|FAIL",
    "build_id": null,
    "rollout_id": null,
    "revision": null,
    "source_sha": null,
    "audit_spine_enabled": null,
    "audit_worker_enabled": null,
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

## Required reconciliation checks

Before a privileged staging enablement packet may be prepared:

1. `repository_sha` is exact 40-hex and still equals protected `main`.
2. `environment` is exactly `staging` and `project_id` is exactly
   `guardentra-staging`.
3. App Hosting live source/build/revision are observed directly; repository YAML alone
   is insufficient.
4. Current `AUDIT_SPINE_ENABLED` and `AUDIT_WORKER_ENABLED` live values are observed
   without reading secret payloads.
5. Cloud SQL instance/state/connection and private connectivity are observed directly.
6. Runtime service-account identity is observed and least-privilege role names are
   recorded.
7. Secret evidence proves references/access metadata only; `secret_payloads_read`
   remains `false`.
8. A rollback baseline identifies the exact currently serving staging build/revision and
   current audit flags.
9. Any access denial is recorded as `BLOCKED`; it must not be reinterpreted as proof
   that a resource is absent.
10. No production resource is queried or mutated merely to satisfy this staging record.

## Later staging-live acceptance record

The inventory above is **not** staging-live acceptance. After a separately scoped,
Owner-authorized enablement/change packet is executed, the live acceptance evidence must
add exact-SHA results for:

- staging health/readback before and after change;
- org/admin audit event persistence;
- vendor-portal audit event persistence;
- durable outbox enqueue and worker processing;
- event/hash-chain persistence;
- successful verify/readiness and export behavior;
- deliberate tamper detection;
- observable failure/event-loss behavior;
- stale `processing` lease reclaim;
- crash/retry logical exactly-once persistence;
- retention/storage ownership;
- rollback execution/readiness;
- explicit confirmation that production was unchanged.

Only that later record can support `STAGING_LIVE_VERIFIED`. Production enablement remains
a separate Owner-authorized release decision.
