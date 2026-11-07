# GuardEntra current-source staging → production go-live E2E

Issue: #124

This runbook is the final runtime release gate. It does not grant deployment or cloud mutation authority by itself.

## Preconditions

- protected `main` SHA is recorded exactly;
- required CI is green on that SHA;
- #72 invitation email delivery is live accepted in staging;
- #73 production scanner parity/proof is ready for promotion;
- #74 staging audit spine is live accepted;
- #126 legacy `guardentra-7f582` automatic main-rollout integrity is resolved with live readback;
- current staging build/revision/source SHA is recorded;
- current production rollback baseline is recorded;
- controlled test identities/data are used;
- no secret values, tokens, raw auth output, provider prompts, or real customer data are captured.

## Staging journey

Every required step must be recorded in `GO_LIVE_E2E_EVIDENCE_TEMPLATE.json`.

1. Authenticate as a controlled pilot organization admin.
2. Verify server-authoritative tenant/profile bootstrap.
3. Add a controlled test vendor.
4. Create an assessment and record stamped framework pack IDs/question-bank version.
5. Send the invitation.
6. Prove `QUEUED -> PROVIDER_ACCEPTED -> INBOX_RECEIVED`.
7. Open the vendor portal through the real invitation path.
8. Answer questions; refresh/reload and prove durable persistence.
9. Upload a clean evidence fixture; prove `scan_pending -> clean`.
10. Upload the EICAR fixture; prove quarantine/fail closed.
11. Submit the assessment.
12. Review exceptions and finalize a bounded decision with residual-risk/remediation evidence.
13. Generate the decision packet/export.
14. Prove audit event/outbox/worker/hash-chain persistence and verification.
15. Re-login/refresh and verify no false-success or lost state.
16. Capture health/readback and cleanup evidence.

## Production promotion

Production may be promoted only after all required staging steps PASS on the exact release SHA.

1. Re-read protected `main` and compare to accepted staging source SHA.
2. Re-check environment/config drift.
3. Record exact production rollback baseline.
4. Deploy only through the existing approved production path.
5. Verify health/readback.
6. Run a bounded production smoke/E2E using controlled test data.
7. Verify tenant/environment isolation and no staging/prod leakage.
8. Record production build/revision/source SHA.
9. Clean up controlled fixtures.
10. Recalculate the #69 production-readiness score from live evidence.

## Result vocabulary

- `PASS`: direct evidence supports the required result.
- `FAIL`: observed behavior contradicts the requirement.
- `BLOCKED`: evidence cannot be collected with the available authority/tool.
- `SKIPPED`: allowed only for explicitly optional steps. Required steps may not be skipped.

## Hard release rule

`MERGED != STAGING_LIVE_VERIFIED != PRODUCTION_LIVE_VERIFIED`.

Only a complete, exact-SHA-bound evidence record with all required staging and production steps passing may support `PRODUCTION_LIVE_VERIFIED` / GO LIVE.
