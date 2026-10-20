#!/bin/bash
# SOC VM provisioning — Ubuntu Server 22.04, 4 vCPU / 6GB RAM, NAT network
# Source: .kilo/plans/1792475736112-siem-firebase-cloud-project.md (Week 1)
# Environment constraint: containers ONLY inside this VM; never on host.
set -euo pipefail

echo "=== SOC VM Provisioning ==="
echo "Target: Ubuntu Server 22.04 | 4 vCPU | 6GB RAM | NAT network"

# 1. System updates
apt-get update -qq && apt-get upgrade -y -qq

# 2. Docker + Docker Compose (containers only inside VM)
apt-get install -y -qq curl git make docker.io docker-compose
systemctl enable docker
systemctl start docker

# 3. Clone / link this repo (repo root is the working directory)
# Expected path after clone: /home/chrisplaysxd/Projects/Misc/SIEM-Cloud-computing-project/
if [ -f /home/chrisplaysxd/Projects/Misc/SIEM-Cloud-computing-project/docker-compose.yml ]; then
    echo "Repo linked; docker-compose.yml found."
else
    echo "WARNING: repo not linked at expected path."
fi

# 4. Start Wazuh single-node + Splunk (see docker-compose.yml)
# Note: first start pulls images; takes 2-5 min on 6GB VM.
if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.yml up -d wazuh.manager wazuh.indexer wazuh.dashboard splunk || echo "Compose failed — check memory (16GB host constraint)."
else
    echo "docker-compose not installed; skipping compose start."
fi

# 5. Create service-account path with strict permissions (per risk item)
mkdir -p /etc/siem-bridge
chmod 700 /etc/siem-bridge
touch /etc/siem-bridge/sa.json || true
chmod 600 /etc/siem-bridge/sa.json || true
chown root:root /etc/siem-bridge/sa.json || true

# 6. Verify Wazuh agent enrollment endpoint
ss -tlnp | grep -E '1514|1515' || echo "Wazuh manager ports not listening yet."

echo "=== SOC VM provisioned ==="
echo "Next: enroll agent VM (see provision/agent-vm/provision.sh)"
echo "Validation query (post-ingest): index=main earliest=-24h | stats count"
