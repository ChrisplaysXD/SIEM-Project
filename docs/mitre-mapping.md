# MITRE ATT&CK Mapping

Demo attacks, the Wazuh rules that fire on them, and the artifact each stage of the
pipeline produces. Rule IDs refer to the Wazuh 4.9.0 default ruleset unless marked as a
custom local rule.

| Attack | Wazuh rule ID(s) | ATT&CK technique | Tactic | Detection source (Wazuh log rule) | Pipeline artifact (Wazuh dashboard, Splunk search, Firestore doc, UI badge) |
|---|---|---|---|---|---|
| SSH brute force (`hydra -l root -P rockyou.txt ssh://agent`) | 5710 (sshd authentication failed), 5712 (brute force, 10 failures from one source) | T1110.001 — Brute Force: Password Guessing | Credential Access | `sshd` decoder on `/var/log/auth.log`; 5710 fires per failed attempt, 5712 correlates the burst and raises the level | Wazuh dashboard: rule 5712 alert, `data.srcip` populated. Splunk: `index=main rule_id=5712 \| stats count by src_ip`. Firestore: `alerts/{id}` with `rule_id: 5712`, `level: 10`, `mitre.id: ["T1110.001"]`, `vt` block. UI: red "SSH Brute Force" row plus `auto-responded` badge once `response_actions` is written. |
| Nmap SYN port scan (`nmap -sS -p- 10.0.2.20`) | 40601 family (port-scan / direct-attack rules, 40600–40699 range) | T1046 — Network Service Discovery | Discovery | Wazuh network-based rules over the agent's packet/firewall telemetry plus `ossec` decoder aggregation; repeated connection attempts to closed ports | Wazuh dashboard: burst of 40601-family alerts from one `srcip`. Splunk: `index=main rule_id=406* \| stats count by src_ip, rule_id`. Firestore: `alerts/{id}` with `level` typically 6–8, no `vt` block unless level ≥7. UI: amber "Port Scan" badge with source-IP grouping in the dashboards view. |
| Failed sudo attempts / privilege escalation attempt (wrong password loop, then `sudo su`) | 5400-family: 5404 (three failed sudo attempts), 5405 (repeated attempts), 5407 (unsuccessful sudo to root) | T1548.003 — Abuse Elevation Control Mechanism: Sudo and Sudo Caching | Privilege Escalation | `sudo` decoder on `/var/log/auth.log` and journald; rule level escalates with repetition count | Wazuh dashboard: 5405/5407 alerts with the invoking user in `data.srcuser`. Splunk: `index=main rule_id IN (5404,5405,5407) \| table _time, agent_name, srcuser`. Firestore: `alerts/{id}` with `mitre.tactic: "Privilege Escalation"`. UI: "PrivEsc Attempt" badge, escalated to an incident when an analyst acknowledges it. |
| SUID enumeration (`find / -perm -4000 -type f 2>/dev/null`) | No default rule; custom local rule in the 100100–100199 range fed by `command`/auditd monitoring | T1083 — File and Directory Discovery | Discovery | Custom Wazuh rule over `full_command` matching `find .* -perm -4000`, or auditd `execve` events forwarded via `auditd` decoder; level set to 6 | Wazuh dashboard: custom-rule alert with the full command line. Splunk: `index=main rule_id=1001* \| table _time, agent_name, full_log`. Firestore: `alerts/{id}` with `rule_id: 100100`. UI: "Discovery" badge; low severity, triaged but not pushed. |

## How Wazuh maps built-in rules to ATT&CK

Every rule in the default ruleset that has a documented technique carries a `mitre` block
in its XML definition. When the rule fires, the manager serialises that block into the
alert record written to `/var/ossec/logs/alerts/alerts.json`, so downstream consumers do
not need their own mapping table:

```json
{
  "rule": {
    "id": "5712",
    "level": 10,
    "description": "sshd: brute force trying to get access to the system.",
    "mitre": {
      "id": ["T1110.001"],
      "tactic": ["Credential Access"],
      "technique": ["Brute Force: Password Guessing"]
    }
  },
  "agent": { "id": "001", "name": "agent-vm" },
  "data": { "srcip": "10.0.2.15" },
  "timestamp": "2026-10-20T06:12:41.113+0000"
}
```

The bridge daemon copies `rule.id`, `rule.level`, `rule.mitre.id` and `rule.mitre.tactic`
into the Firestore `alerts` document without re-deriving them, and the React SPA renders
the tactic as a badge. Splunk receives the same JSON through the Universal Forwarder, so a
single `rule.mitre.tactic` field supports the ATT&CK coverage panel in both the Wazuh
dashboard and the SPL dashboards. Where the default ruleset has no coverage — SUID
enumeration is the demo case — the gap is closed with a custom local rule that declares the
same `mitre` block, keeping the downstream schema uniform.
