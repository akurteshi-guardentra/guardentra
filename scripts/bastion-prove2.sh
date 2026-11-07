#!/bin/bash
set -euo pipefail

cat >&2 <<'EOF'
REFUSED: scripts/bastion-prove2.sh is a quarantined historical helper.

Historical target: guardentra-7f582 (legacy/demo/rollback context)
Current staging authority: guardentra-staging
Current production authority: guardentra-prod

Do not replay the historical Cloud SQL proxy, Secret Manager, or live-prove commands.
For audit-spine work, collect the current Issue #74/#116 read-only inventory and generate
a fresh exact-SHA, environment-bound enablement/prove packet under separate authority.

Issue #130 preserves this refusal; git history retains the original procedure.
EOF
exit 2
