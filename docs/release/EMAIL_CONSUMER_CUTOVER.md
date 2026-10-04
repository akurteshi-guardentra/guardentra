# Email single-consumer cutover gate (#87)

This gate prevents GuardEntra from deliberately releasing with both the managed Firebase Trigger Email extension and a future self-managed mail worker active on the same `mail` collection.

The live gate deliberately avoids `firebase ext:list`: Firebase CLI may ensure/enable the Extensions API before listing instances. Instead, the gate obtains the currently authenticated Google access token from `gcloud auth print-access-token` and performs only an HTTP GET to the Firebase Extensions instance-list endpoint. The request can read or fail; it does not enable APIs or mutate extension state.

## Rule

Exactly one state is permitted for a chosen target:

| Target | Managed Trigger Email | Self-managed worker |
|---|---|---|
| `managed_extension` | ACTIVE | disabled |
| `self_managed` | absent | active |
| `disabled` | absent | disabled |

Any unknown, stale, ambiguous, transitional, or dual-active observation fails closed.

An installed extension in `ERRORED` or another non-ACTIVE state is **not** accepted as disabled. For a self-managed cutover, the managed instance must be absent from the live extension inventory.

## Live preflight

Example for staging:

```powershell
.\scripts\release\Test-EmailConsumerGate.ps1 \
  -ProjectId guardentra-staging \
  -TargetConsumer managed_extension \
  -SourceSha <exact-40-char-sha> \
  -WorkerEvidencePath <fresh-worker-state.json> \
  -EvidenceOut <checkpoint-path.json>
```

The command prints only a safe state summary. The Google access token and raw Firebase Extensions API response are never printed. Extension configuration may contain sensitive SMTP parameters.

## Self-managed worker evidence

#80 must produce a fresh machine-readable record from its actual deployed runtime inventory:

```json
{
  "schema": "guardentra.email_worker_state.v1",
  "project_id": "guardentra-staging",
  "consumer": "self_managed",
  "state": "active",
  "observed_utc": "2026-10-04T12:00:00Z",
  "source_sha": "<deployed-sha>"
}
```

The cutover gate does not accept a human assertion in place of this record.

## Rollback

Rollback must restore exactly one previously proven consumer, then rerun the gate before live traffic. Never enable the old managed extension while the self-managed worker remains active, or vice versa.

## Acceptance boundary

This code implements the deterministic preflight contract only. Issue #87 remains open until staging evidence proves that one queued message produces exactly one provider submission and the old/new consumer states, exact source SHA, and rollback evidence are attached. Production cutover remains separately authorized.
