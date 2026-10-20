# Cloud-Native SIEM with Wazuh, Splunk & Firebase

Cloud computing class project. Solo. A web-based SIEM dashboard backed by Firebase, fed by a Wazuh + Splunk detection pipeline running in a local lab, demonstrated with simulated attacks.

- **Plan**: `.kilo/plans/1792475736112-siem-firebase-cloud-project.md` (source of truth)
- **Timeline**: 3-4 weeks
- **Scope**: Core pipeline + 2 extras (SOAR active response, VirusTotal enrichment)
- **Firebase plan**: Spark (free, $0/month) — no Cloud Functions; self-hosted bridge writes to Firestore

## Architecture

```
[Agent VM: Ubuntu, 1vCPU/2GB] --Wazuh agent--> [SOC VM: Ubuntu, 4vCPU/6GB, NAT]
     (hydra/nmap/privesc demo)         ├─ Wazuh single-node (manager / indexer / dashboard)
                                       ├─ Splunk Enterprise (free tier, 500MB/day cap)
                                       ├─ Universal Forwarder (tails /var/ossec/logs/alerts/alerts.json, level ≥3)
                                       └─ Bridge daemon (Node.js, systemd): dedupe → VT enrich → Firestore → FCM

React SPA (Firebase Hosting) ↔ Firebase Auth / Firestore / FCM
```

Key design points:
- Splunk free tier caps at 500MB/day. Wazuh pre-filters (only rule level ≥3 forwarded) before Splunk ingestion.
- VirusTotal enrichment applies only to level ≥7 alerts with 24h IP caching (public API = 4 req/min). Degrades gracefully (stores alert without `vt` field — never drops).
- Service account key (`/etc/siem-bridge/sa.json`) is mode 600, root-owned, `.gitignore`-protected.
- Containers ONLY inside SOC VM (host has Docker Desktop hang history per session notes).

## Milestones

| Week | Deliverable |
|---|---|
| 1 — Lab up | SOC VM (Wazuh single-node + Splunk via docker-compose); Agent VM enrolled; repo skeleton (`docker-compose.yml`, `README`, `.gitignore` for `/etc/siem-bridge/sa.json`) |
| 2 — Firebase pipeline | Firebase Auth + Firestore + Hosting; bridge daemon (tail → dedupe → Firestore); smoke test (`make inject-test-alert`) |
| 3 — UI + extras | React SPA (live alerts, incidents, Recharts dashboards); SOAR firewall-drop; VirusTotal enrichment |
| 4 — Demo + report | Attack simulations (`hydra`, `nmap`, privesc attempt); MITRE mapping; cost note ($0 Spark); architecture diagram |

## Repository Layout

```
.
├── docker-compose.yml          # Wazuh manager/indexer/dashboard + Splunk Enterprise
├── .gitignore                      # /etc/siem-bridge/sa.json excluded
├── provision/soc-vm/provision.sh # SOC VM setup (Docker, compose start, key hygiene)
├── provision/agent-vm/provision.sh # Agent enrollment + event flow check
├── scripts/splunk/inputs.conf     # UF tailing /var/ossec/logs/alerts/alerts.json (level ≥3)
├── README.md                     # This file
└── docs/                           # Report, architecture diagram, MITRE mapping (Week 4)
```

## Validation Plan

End-to-end acceptance chain (manual demo):
1. Agent VM: `hydra` SSH brute force →
2. Wazuh alert (<30s) →
3. Splunk index (`index=main earliest=-24h | stats count`) →
4. Firestore `alerts` doc (via bridge `firebase-admin`) →
5. React SPA `onSnapshot` live list + FCM push (level ≥10) →
6. Active response: `iptables` drop on agent (`response_actions` doc written by bridge).

Smoke tests:
- `make inject-test-alert` injects test payload offline.
- `kill -9` bridge → systemd restart → file tail position preserved.
- Firestore rules: unauthenticated read denied; analyst updates status; admin-only paths enforced.

## Risks & Mitigations

- **RAM pressure (16GB host)**: SOC VM 6GB + agent 2GB ≈ 12-13GB. Close browsers/IDE during demos; keep Splunk indexing minimal.
- **Splunk 500MB/day cap**: enforced by Wazuh pre-filter; verify with `index=main earliest=-24h | stats count`. Never exceed.
- **Docker on host hangs** (session history): containers ONLY inside SOC VM.
- **Service account key hygiene**: file permission 600, root-owned, `.gitignore`-covered. Document rotation in report. Trade-off noted: real deployment uses Workload Identity.
- **VirusTotal rate limit (4/min)**: cache IPs 24h, only level ≥7; graceful degradation (no `vt` field, never drop).

## Agent Model Routing (execution-time only)

Not part of the SIEM product — implementation work routed by task difficulty per benchmark evidence (Oct 2026):

- Complex tasks → `openrouter/z-ai/glm-5.3-flash` (Coding Index 71.5, SWE-bench 92%): bridge daemon, Firestore security rules, SOAR response, React auth/onSnapshot/FCM.
- Simple tasks → `openrouter/deepseek/deepseek-v4.1-flash-1017` (cheapest output $0.0112/M): provisioning scripts, `docker-compose.yml` review, README/docs, test payloads, chart components.
- Fallback: if GLM truncates (observed 32k cap risk), retry once with DeepSeek before escalating.

## Out of Scope

Windows endpoints / Sysmon, Splunk SOAR/Phantom, Cloud Functions (Spark plan), multi-tenancy, HA/clustering, production hardening, PDF reports (listed as future work).
