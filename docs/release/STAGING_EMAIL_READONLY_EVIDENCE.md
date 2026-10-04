# #72 staging email read-only evidence probe

This workflow is deliberately **read-only**. It does not install, configure, update, or uninstall Firebase Extensions and does not write cloud resources.

After this file reaches `main`, the push-triggered workflow:

1. authenticates with the repository's existing Google Workload Identity Federation identity,
2. attempts a read-only `gcloud projects describe guardentra-staging`,
3. runs `firebase ext:list --json --project guardentra-staging`,
4. passes the raw JSON only to a local sanitizer,
5. prints only a sanitized send-email inventory,
6. deletes the raw extension JSON before the job exits.

The raw `ext:list` payload is never uploaded or printed because extension configuration can contain sensitive SMTP parameters.

A successful job proves only **read access and managed-extension inventory state**. It does not prove message delivery, self-managed worker absence, provider submission, inbox receipt, or production state.

If WIF cannot read `guardentra-staging`, the job fails closed and the failure becomes evidence that the current GitHub cloud identity is still bound only to the legacy project.
