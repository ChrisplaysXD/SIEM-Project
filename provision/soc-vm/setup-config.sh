#!/bin/bash
# Fetch official Wazuh single-node config files + generate TLS certs.
# Downloads pinned files from wazuh/wazuh-docker v4.9.0 (official single-node stack),
# then runs the certs generator. Idempotent.
set -euo pipefail

cd "$(dirname "$0")/../.."
BASE="https://raw.githubusercontent.com/wazuh/wazuh-docker/v4.9.0/single-node"

FILES=(
  "config/wazuh_indexer/wazuh1.indexer.yml"
  "config/wazuh_indexer/internal_users.yml"
  "config/wazuh_cluster/wazuh_manager.conf"
  "config/wazuh_dashboard/opensearch_dashboards.yml"
  "config/wazuh_dashboard/wazuh.yml"
  "config/certs.yml"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "exists: $f"
  else
    mkdir -p "$(dirname "$f")"
    curl -fSL --retry 3 -o "$f" "$BASE/$f"
    echo "downloaded: $f"
  fi
done

if [ ! -f config/wazuh_indexer_ssl_certs/root-ca.pem ]; then
  docker compose -f generate-indexer-certs.yml run --rm generator
else
  echo "certs already generated"
fi

cd config/wazuh_indexer_ssl_certs
for name in manager indexer dashboard; do
  if [ -f root-ca.pem ] && [ ! -f "root-ca-$name.pem" ]; then
    cp root-ca.pem "root-ca-$name.pem"
    echo "copied root-ca.pem -> root-ca-$name.pem"
  fi
done

echo "Config + certs ready. Run: make compose-up"
