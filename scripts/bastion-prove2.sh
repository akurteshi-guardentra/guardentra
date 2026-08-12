#!/bin/bash
set -euo pipefail
cd ~
pkill -f cloud-sql-proxy || true
if [ ! -x ./cloud-sql-proxy ]; then
  curl -fsSL -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.15.2/cloud-sql-proxy.linux.amd64
  chmod +x cloud-sql-proxy
fi
./cloud-sql-proxy --private-ip --port 5433 guardentra-7f582:europe-west3:guardentra-audit > proxy.log 2>&1 &
sleep 5
export AUDIT_SPINE_ENABLED=true
export AUDIT_WORKER_ENABLED=false
export AUDIT_DATABASE_URL="$(gcloud secrets versions access latest --secret=AUDIT_DATABASE_URL_PROXY --project=guardentra-7f582)"
export AUDIT_DATABASE_URL_MIGRATOR="$(gcloud secrets versions access latest --secret=AUDIT_DATABASE_URL_MIGRATOR_PROXY --project=guardentra-7f582)"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi
npx tsx scripts/phase2-live-prove.ts
echo PROVE_EXIT=$?
tail -12 proxy.log