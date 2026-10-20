#!/bin/bash
# SOC VM provisioning — Ubuntu Server 22.04, 4 vCPU / 6GB RAM, NAT network.
# Containers run ONLY inside this VM. Requires root.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

cd "$(dirname "$0")/../.."
echo "=== SOC VM provisioning (repo root: $PWD) ==="

apt-get update -qq
apt-get install -y -qq curl ca-certificates git make

if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
fi
docker compose version || { echo "ERROR: docker compose v2 required"; exit 1; }
systemctl enable --now docker

mkdir -p data/ossec/logs data/wazuh-indexer data/splunk-etc data/splunk-var /var/lib/siem-bridge
chmod 750 data/ossec/logs

# Bridge service account: key is provided manually at /etc/siem-bridge/sa.json (never committed)
useradd --system --no-create-home siem-bridge 2>/dev/null || true
mkdir -p /etc/siem-bridge
chown root:siem-bridge /etc/siem-bridge
chmod 750 /etc/siem-bridge
if [ -f /etc/siem-bridge/sa.json ]; then
    chown root:siem-bridge /etc/siem-bridge/sa.json
    chmod 640 /etc/siem-bridge/sa.json
else
    echo "NOTE: place the Firebase service-account key at /etc/siem-bridge/sa.json (mode 640, owner root:siem-bridge)"
fi
chown siem-bridge:siem-bridge /var/lib/siem-bridge

./provision/soc-vm/setup-config.sh

./provision/soc-vm/configure-active-response.sh

docker compose up -d --wait

echo "=== SOC VM provisioned ==="
echo "Wazuh dashboard: https://$(hostname -I | awk '{print $1}'):5601 (admin / SecretPassword)"
echo "Splunk:          http://$(hostname -I | awk '{print $1}'):8000 (admin / SplunkAdmin2026)"
echo "Bridge env template: bridge/.env.example -> /etc/siem-bridge/bridge.env (mode 600)"
echo "Verification (post-ingest): index=main earliest=-24h | stats count"
