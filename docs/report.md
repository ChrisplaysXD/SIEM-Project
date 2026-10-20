# A Cloud-Native SIEM: Wazuh Detection, Splunk Analytics, and a Firebase Delivery Plane

## Abstract

This report documents a cloud-native security information and event management (SIEM)
system built for a cloud computing course. Detection runs in a two-VM lab, with Wazuh as
the detection engine and Splunk as the log analytics layer. The delivery plane is hosted on
Firebase's free Spark plan: Auth for identity, Firestore as the alert store, Hosting for
the React single-page application, and Cloud Messaging for push. Because Spark has no Cloud
Functions, a self-hosted Node.js bridge on the SOC VM tails the Wazuh alert file,
deduplicates, enriches selected alerts with VirusTotal, and writes to Firestore. Two extras
extend the pipeline: a firewall drop on SSH brute force and VirusTotal enrichment with a
24-hour cache. The chain is validated end to end at zero recurring cost.

## Architecture

```
 [ Agent VM: Ubuntu, 1 vCPU / 2 GB ]
   hydra | nmap | sudo loop | SUID find
              | Wazuh agent (1514/tcp, TLS)
              v
 [ SOC VM: Ubuntu, 4 vCPU / 6 GB, NAT ]
   +--------------------------------------------------------------+
   | Wazuh manager  ->  /var/ossec/logs/alerts/alerts.json        |
   | Wazuh indexer + dashboard (local triage UI)                  |
   | Splunk Enterprise  <-  Universal Forwarder (level >= 3)      |
   | Bridge daemon (Node.js, systemd)                             |
   |   tail -> dedupe -> VT enrich -> Firestore -> FCM            |
   | Wazuh active response: firewall-drop (5710/5712, 600 s)      |
   +--------------------------------------------------------------+
              |  Admin SDK (HTTPS, service account)
              v
 [ Firebase: Auth | Firestore | Hosting | FCM ]  <->  React SPA
```

Detection stays next to the telemetry, where latency is milliseconds and nothing leaves
the lab network until it has been judged suspicious. Only alert records cross into the
cloud, keeping that tier small and free of sensitive payloads.

## Methodology

**Week 1 — lab bring-up.** The SOC VM was provisioned at 4 vCPU / 6 GB and the agent VM at
1 vCPU / 2 GB on one NAT network. Wazuh 4.9.0 ran as a single-node Compose stack with
certificates from the official generator; Splunk Enterprise ran alongside it with the
Universal Forwarder monitoring the bind-mounted log directory at level 3 and above.
Enrolment was confirmed through dashboard heartbeats.

**Week 2 — cloud pipeline.** Firebase was configured with Auth, Firestore in Native mode
and Hosting, with security rules written before any data existed. The bridge daemon was
installed as a systemd unit, and a synthetic alert injector allowed offline testing.

**Week 3 — interface and extras.** The Vite/React SPA gained an `onSnapshot` alerts list,
an incident workflow (acknowledge, escalate, resolve), Recharts dashboards and FCM
registration. Active response and VirusTotal enrichment were wired into the daemon.

**Week 4 — validation and reporting.** Attacks were run from the agent VM, evidence was
captured at each hop, and this report and the MITRE mapping were produced.

## Implementation Summary

**Wazuh.** The manager holds the rule set, MITRE annotations and active-response
configuration. Only rule level 3 and above is forwarded, which keeps Splunk inside its
daily cap. Logs are bind-mounted on the VM host so the manager, forwarder and bridge read
one file rather than fanning out copies.

**Splunk.** SPL over `index=main` answers questions about alert volume per rule, top
source addresses and tactic distribution. It is deliberately not the record of alert state.

**Bridge daemon.** A Node.js service keeping a byte offset into `alerts.json` so restarts
do not replay the backlog. It deduplicates on `(agent_id, rule_id, timestamp)`, normalises
the alert into the Firestore schema, and writes with the Admin SDK. Failures are logged to
journald and the offset always advances, so a malformed line or a transient write error can
never stall the tail; a failed enrichment never drops an alert.

**React SPA.** Authenticated with Firebase Auth, authorised by custom claims (`analyst` or
`admin`), and rendered from Firestore listeners so the list updates without polling. Rules
deny unauthenticated reads and restrict status transitions to signed-in analysts.

**Firestore.** Four collections: `alerts` (state and enrichment), `incidents`,
`response_actions` (SOAR audit), and `audit` (append-only actor/action records).

## The Two Extras

**SOAR active response.** Wazuh's `firewall-drop` runs on the agent when rules 5710 and
5712 fire, inserting an `iptables` rule for 600 seconds. The rationale is containment
speed: a brute-force burst is worth blocking immediately, and no human is available
immediately. The bridge mirrors the action into `response_actions` so the UI can show an
`auto-responded` badge, giving the analyst an audit trail rather than an invisible side
effect. The timeout is a compromise: long enough to break a scripted attack, short enough
that a false positive expires. The risk of an attacker spoofing a
trusted address to trigger self-denial is accepted for the lab and listed as future work.

**VirusTotal enrichment.** Only alerts at level 7 and above trigger a lookup, cached per
IP for 24 hours. The public API allows four requests per minute, so an unfiltered design
would exhaust the quota during a port scan or block the write path behind a rate limiter.
The severity gate plus caching cuts lookup volume by more than an order of magnitude, and
failures degrade gracefully: the alert is stored without a `vt` field.

## Validation Walkthrough

1. On the agent VM, `hydra` is pointed at SSH with a short password list.
2. Within 30 seconds the manager raises 5710 per attempt and 5712 on the burst.
   [SCREENSHOT: Wazuh rule 5712 detail with mitre block]
3. SPL confirms the record: `index=main rule_id=5712 | stats count by src_ip`.
   [SCREENSHOT: Splunk search]
4. The bridge writes `alerts/{id}` with agent, rule, level, MITRE identifiers, source IP
   and VirusTotal block. [SCREENSHOT: Firestore document]
5. The open SPA prepends the alert without a refresh; level 10 produces a browser
   notification. [SCREENSHOT: UI list and FCM toast]
6. Active response inserts the drop rule; `iptables -L INPUT -n` shows the blocked address
   and further attempts fail. [SCREENSHOT: iptables output]
7. Recovery: `kill -9`, systemd restarts the bridge, the offset is intact, and no duplicate
   alerts appear. [SCREENSHOT: systemctl status]

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RAM exhaustion on the 16 GB host (SOC 6 GB + agent 2 GB) | Medium | Demo failure | Close browsers and IDE; minimal Splunk indexing; no host containers |
| Splunk exceeds 500 MB/day | Medium | Search stops for the day | Level ≥3 filter plus forwarder blacklist; daily `stats count` |
| Service-account key exposure | Low | Firestore compromise | Mode 640 `root:siem-bridge`, gitignored, rotation documented; Workload Identity in production |
| VirusTotal rate limit (4/min) | High without control | Enrichment stalls | Severity gate, 24-hour cache, graceful degradation |
| Bridge single point of failure | Medium | Alerts stop reaching cloud | systemd restart, durable offset, backlog replay |

## Cost Analysis

The product costs $0 per month. Auth, Firestore, Hosting and FCM sit inside Spark quotas at
lab volume: a few thousand alert documents, a handful of readers, and dozens of push
messages per demo. Splunk runs under a 60-day trial licence and Wazuh is open source, both
inside the lab VMs. Model routing used during implementation (OpenRouter) is build tooling,
out of scope of the product's operating cost.

## Future Work

Short-term: PDF incident reports, Slack and Telegram channels alongside FCM, and an
audit-trail view over the `audit` collection. Medium-term: multi-tenant isolation with
per-organisation Firestore paths, Windows endpoints with Sysmon, and enrichment beyond IP
reputation. Longer-term: high availability for the manager and bridge, Workload Identity
Federation in place of the static key, and migration to Blaze for Cloud Functions and
automated backups. One further item is tuning: the rules are Wazuh defaults, and
production would invest in suppression before automating anything beyond a 600-second
drop.
