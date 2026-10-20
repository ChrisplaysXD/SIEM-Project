#!/bin/bash
# Privilege-escalation attempt simulation (demo). Run on the agent VM.
# Failed sudo attempts + SUID enumeration trigger Wazuh local rules (T1548, T1083).
# Usage: ./privesc.sh [attempts]
set -euo pipefail

ATTEMPTS="${1:-8}"

echo "[demo] failed sudo attempts ($ATTEMPTS) -> MITRE T1548 (Abuse Elevation Control)"
for i in $(seq 1 "$ATTEMPTS"); do
    echo "wrong-password-$i" | timeout 3 sudo -S -u nobody id >/dev/null 2>&1 || true
    sleep 1
done

echo "[demo] SUID enumeration -> MITRE T1083 (File and Directory Discovery)"
find / -perm -4000 -type f 2>/dev/null | head -20

echo "[demo] done. Verify: Wazuh dashboard shows sudo/auth failure alerts."
