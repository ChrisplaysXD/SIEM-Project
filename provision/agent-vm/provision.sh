#!/bin/bash
# Agent VM provisioning — Ubuntu Server, 1 vCPU / 2GB RAM, same NAT network as SOC VM.
# Requires root. WAZUH_MANAGER_IP must be set (see README for the NAT network setup).
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

WAZUH_MANAGER_IP="${WAZUH_MANAGER_IP:?export WAZUH_MANAGER_IP=<soc-vm-ip> first}"
WAZUH_AGENT_NAME="${WAZUH_AGENT_NAME:-ubuntu-agent-01}"
WAZUH_VERSION="4.9.0"

echo "=== Agent VM provisioning (manager: $WAZUH_MANAGER_IP) ==="

apt-get update -qq
apt-get install -y -qq curl gnupg

DEB="wazuh-agent_${WAZUH_VERSION}-1_amd64.deb"
curl -fSLO --retry 3 "https://packages.wazuh.com/4.x/apt/pool/main/w/wazuh-agent/$DEB"
dpkg-deb --info "$DEB" >/dev/null

WAZUH_MANAGER="$WAZUH_MANAGER_IP" dpkg -i "$DEB"

# Enroll against the manager on port 1515
/var/ossec/bin/agent-auth -m "$WAZUH_MANAGER_IP" -A "$WAZUH_AGENT_NAME"

systemctl enable wazuh-agent
systemctl restart wazuh-agent

# Verify: agent is an outbound client — check ossec.log, not listening ports
for i in $(seq 1 30); do
    if grep -q "Connected to the server" /var/ossec/logs/ossec.log 2>/dev/null; then
        echo "=== Agent connected to manager ==="
        exit 0
    fi
    sleep 2
done

echo "ERROR: agent did not connect within 60s. Check:"
echo "  - manager reachable on $WAZUH_MANAGER_IP:1514/1515"
tail -20 /var/ossec/logs/ossec.log
exit 1
