#!/bin/bash
# Port-scan simulation (demo). Run on the agent VM.
# Triggers Wazuh rules 40601/40602 (Nmap/port sweep, MITRE T1046 Reconnaissance).
# Usage: ./portscan.sh <soc-vm-ip>
set -euo pipefail

TARGET="${1:?usage: portscan.sh <soc-vm-ip>}"

command -v nmap >/dev/null || { echo "nmap not installed. apt-get install -y nmap"; exit 1; }

echo "[demo] SYN port scan vs $TARGET"
echo "[demo] watch: Wazuh rule 40601 (sshd: Possible port scan) in dashboard"
nmap -sS -T4 --top-ports 100 "$TARGET" 2>&1
echo "[demo] done."
