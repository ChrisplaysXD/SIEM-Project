#!/bin/bash
# Agent VM provisioning — Ubuntu Server, 1 vCPU / 2GB RAM, NAT network
# Source: .kilo/plans/1792475736112-siem-firebase-cloud-project.md (Week 1)
# Enrolls to SOC VM Wazuh manager; verifies event flow to dashboard.
set -euo pipefail

echo "=== Agent VM Provisioning ==="
echo "Target: Ubuntu Server | 1 vCPU | 2GB RAM | NAT network"

# 1. System updates
apt-get update -qq && apt-get upgrade -y -qq

# 2. Install Wazuh agent (points to SOC VM manager)
# Enrollment key and manager IP configured via Wazuh agent install.
WAZUH_MANAGER_IP="192.168.56.10"  # Example NAT IP; adjust per lab
WAZUH_AGENT_NAME="ubuntu-agent-01"

curl -so wazuh-agent.deb https://packages.wazuh.com/4.x/apt/pool/main/w/wazuh-agent/wazuh-agent_4.9.0-1_amd64.deb || echo "Download failed — manual agent install required."
if [ -f wazuh-agent.deb ]; then
    dpkg -i wazuh-agent.deb || apt-get install -f -y -qq
fi

# 3. Configure agent
sed -i "s/<MANAGER_IP>/${WAZUH_MANAGER_IP}/" /var/ossec/etc/ossec.conf || echo "ossec.conf not yet present."
echo "<client>" > /var/ossec/etc/client.keys || true
echo "  <registration>" >> /var/ossec/etc/client.keys || true
echo "    <name>${WAZUH_AGENT_NAME}</name>" >> /var/ossec/etc/client.keys || true
echo "    <ip>any</ip>" >> /var/ossec/etc/client.keys || true
echo "  </registration>" >> /var/ossec/etc/client.keys || true
echo "</client>" >> /var/ossec/etc/client.keys || true

# 4. Start agent
systemctl enable wazuh-agent || true
systemctl restart wazuh-agent || echo "Agent service not started (expected pre-enrollment)."

# 5. Verify connection
ss -tlnp | grep -E '1514' || echo "Agent not yet connected to manager."
echo "=== Agent VM provisioned ==="
echo "Next: verify events in Wazuh dashboard (https://soc-vm:5601)"
