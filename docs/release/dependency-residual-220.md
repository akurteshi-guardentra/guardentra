# Dependency residual #220 (2026-11-07)

Read-only residual-risk record after in-range / prior patches. This is not a zero-vulnerability claim, a merge approval for an override, or a deployment record.

## Authority

- Branch base at evaluation: `release/rc-2026-10-08` @ `2ce7d8e951c04958d8fe98c134c29b18505e0ca4`
- Method: `npm ci --omit=dev` then `npm audit --omit=dev`
- Related: #223 (in-range fixes), #204 / `docs/release/dependency-patch-204.md` (gRPC client residual contract), #220

## Current production audit

| Severity | Count |
|---|---|
| critical | 0 |
| high | 4 |
| moderate | 0 |
| low | 0 |

Single root cause (four package entries in the audit graph):

- Client `firebase@12.19.0` → `@firebase/firestore@4.17.2` → `@grpc/grpc-js@1.9.16`
- Advisories: [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) (high), [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4) (low, rolled into the high graph)

Server / Admin path is already patched: `firebase-admin@14.5.0` / `google-gax` resolve `@grpc/grpc-js@1.14.7`.

## Rejected fix paths

| Path | Why rejected |
|---|---|
| `npm audit fix --force` | Proposes `firebase@9.14.0` (semver-major **downgrade**). |
| Root `overrides["@grpc/grpc-js"] = "1.14.7"` | `@firebase/firestore` declares `@grpc/grpc-js` `~1.9.0`. Forcing 1.14.x violates that range and breaks the #204 lock contract in `src/tests/dependencyPatch204.test.ts` (“preserves the Firestore client gRPC branch that cannot accept 1.14.x”). A trial override cleared `npm audit` locally but failed required CI on that contract. |

## Accepted residual (until upstream)

Keep `@grpc/grpc-js@1.9.16` on the client Firestore path until `@firebase/firestore` publishes a range that admits `>=1.13.6` (or Firebase ships a client that does). Re-check with `npm audit --omit=dev` after each Firebase client bump.

No deploy, secret, or rules change is implied by this document.
