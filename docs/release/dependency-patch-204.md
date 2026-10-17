# Dependency patch 204

Source-bound record of the in-range lock update. This is not a zero-vulnerability claim, a merge approval, or a deployment record.

Starting ref: `release/rc-2026-10-08` `42dd54200b60cc697590ad611f82cda56c7f6b7d`, tree `3c3b20dfb90c6b036d3e2347d9e5f3749788ee48`.

Root ranges are unchanged. There is no `overrides` field, no Express upgrade, no Firebase downgrade, and no optional-peer removal. npm wrote the lock entries and their registry integrity values. `npm audit fix` was not used.

Lockfile SHA-256 before: `31a517131c133319fd2080a35751648961c8f011d7ee1cd0c363fcf8f39c17a0`. After: `065acbe47335531133506c81de671a89024b83544e33f2e05ace2863908af044`.

## Resolved paths

| Package | Old path and version | Parent requirement | New version |
|---|---|---|---|
| `proxy-addr` | `node_modules/proxy-addr` 2.0.7 | Express 5.2.1 `^2.0.7`; firebase-tools Express 4.22.2 `~2.0.7` | 2.0.8 |
| `react-router` / `react-router-dom` | both 7.18.1 | root `react-router-dom` `^7.15.1`; 7.18.2 depends on `react-router` 7.18.2 | 7.18.2 |
| `@fastify/busboy` | `node_modules/@fastify/busboy` 3.2.0 | `firebase-admin` 13.10.0 `^3.0.0` | 3.2.2 |
| `@grpc/grpc-js` | `node_modules/@google-cloud/tasks/node_modules/@grpc/grpc-js` 1.14.4 | `@google-cloud/tasks` 7.1.0 → `google-gax` 6.3.0 `^1.12.6` | 1.14.5 |
| `@grpc/grpc-js` | `node_modules/google-gax/node_modules/@grpc/grpc-js` 1.14.4, optional | `google-gax` 4.6.1 `^1.10.9`, used by optional `@google-cloud/firestore` | 1.14.5 |
| `@grpc/grpc-js` | `node_modules/@google-cloud/pubsub/node_modules/@grpc/grpc-js` 1.14.4, dev | `@google-cloud/pubsub` 5.3.1 → `google-gax` 5.0.8 `^1.12.6` | 1.14.5 |

Express stays 5.2.1. Published 2.0.8 is the newest `proxy-addr`. Published `@fastify/busboy` 3.2.3 and `@grpc/grpc-js` 1.14.6 also fit the parent ranges; this patch stops at the requested 3.2.2 and 1.14.5 because those are the first releases that clear the listed advisories. React Router stays at the requested 7.18.2 pair rather than 7.18.4.

## Advisory identity

`npm audit --package-lock-only` on the old lock: 49 package entries (25 moderate, 23 high, 1 critical). On this lock: 45 package entries (25 moderate, 20 high, 0 critical). Counts are package entries, not unique CVEs.

| Advisory | Severity | Vulnerable range | Result on this lock |
|---|---|---|---|
| [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | critical | `proxy-addr` `>=1.1.0 <2.0.8` | Cleared. Resolved 2.0.8. |
| [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) | high | `react-router` `>=7.12.0 <7.18.2` | Cleared. Resolved 7.18.2. |
| [GHSA-xjh9-v7x6-24jw](https://github.com/advisories/GHSA-xjh9-v7x6-24jw) | high | `@fastify/busboy` `>=3.1.0 <3.2.1` | Cleared. Resolved 3.2.2. |
| [GHSA-x8mw-p69m-v3mx](https://github.com/advisories/GHSA-x8mw-p69m-v3mx) | high | `@fastify/busboy` `>=1.0.0 <3.2.1` | Cleared. Resolved 3.2.2. |
| [GHSA-gxm5-99cw-xjw9](https://github.com/advisories/GHSA-gxm5-99cw-xjw9) | moderate | `@fastify/busboy` `<3.2.2` | Cleared. Resolved 3.2.2. |
| [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) | high | `@grpc/grpc-js` `<1.13.6` and `>=1.14.0 <1.14.5` | Cleared for the three 1.14.5 copies. The 1.9.16 copy remains inside `<1.13.6`. |
| [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4) | low | same two ranges as the high gRPC advisory | Same split. The audit summary does not list this low finding in its low total. |

These results identify the installed versions. They do not demonstrate a reachable exploit. Current application code does not set Express `trust proxy`. The React Router advisory text is limited to unstable RSC APIs. The gRPC high advisory concerns server credentials and `getAuthContext`.

## Residuals kept visible

- `@grpc/grpc-js` 1.9.16 remains at `node_modules/@grpc/grpc-js` because `@firebase/firestore` 4.16.0 requires `~1.9.0`. That range cannot accept 1.14.5. `firebase` stays 12.16.0. No override was added.
- `@modelcontextprotocol/sdk` 1.29.0 remains. It is the optional peer of `@google/genai` 2.13.0 (`^1.25.2`) and a firebase-tools dev dependency. [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h) still applies to 1.29.0.
- `fast-uri` 3.1.4 remains through hoisted `ajv` 8.20.0 (`^3.0.1`). Its high audit range is `3.0.0 - 3.1.7`.
- The other high and moderate findings, including developer and build tooling, are unchanged and are not declared harmless.

## Disposable PostgreSQL coverage

`on.pull_request.paths` in `.github/workflows/infra-ci.yml` includes `package-lock.json`. Push filters, permissions, jobs, commands, and services are unchanged. A pull request that changes this lockfile therefore runs the existing disposable PostgreSQL jobs in that workflow. The run identity, checkout commit, and PostgreSQL results for the head that introduced this path line are in the pull request receipt. An older PostgreSQL run is not evidence for this lock. Ordinary Vitest still skips `portalSubmitReplay.firestore.test.ts` when `FIRESTORE_EMULATOR_HOST` is unset.
