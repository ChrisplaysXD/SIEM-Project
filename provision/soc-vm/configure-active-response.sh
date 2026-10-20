#!/bin/bash
# Enable SOAR firewall-drop active response on the Wazuh manager (SOC VM).
# Idempotent: skips if the block already exists. Requires root.
set -euo pipefail

OSSEC_CONF=/var/ossec/etc/ossec.conf
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SNIPPET="$REPO_ROOT/scripts/wazuh/active-response.snippet.xml"

if [ ! -f "$OSSEC_CONF" ]; then
    echo "ERROR: $OSSEC_CONF not found. Run inside the wazuh.manager container or SOC VM with mounted volume."
    exit 1
fi

if grep -q '<active-response>' "$OSSEC_CONF"; then
    echo "active-response block already present; nothing to do."
else
    python3 - "$OSSEC_CONF" "$SNIPPET" <<'PY'
import sys
conf_path, snippet_path = sys.argv[1], sys.argv[2]
with open(conf_path) as f:
    conf = f.read()
with open(snippet_path) as f:
    lines = [l for l in f.read().splitlines() if not l.lstrip().startswith('<!--')]
snippet = '\n'.join(lines).strip()
if '</ossec_config>' not in conf:
    print('ERROR: </ossec_config> closing tag not found')
    sys.exit(1)
conf = conf.replace('</ossec_config>', snippet + '\n</ossec_config>', 1)
with open(conf_path, 'w') as f:
    f.write(conf)
print('active-response block inserted')
PY
fi

if [ -f /var/ossec/bin/wazuh-logtest ] || [ -d /var/ossec ]; then
    /var/ossec/bin/wazuh-control restart 2>/dev/null || systemctl restart wazuh-manager 2>/dev/null || \
        echo "Restart manually: systemctl restart wazuh-manager (or restart the container)."
fi

echo "Verify on agent VM after a brute-force attempt: iptables -L -n | grep DROP"
