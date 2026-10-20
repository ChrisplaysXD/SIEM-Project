# Cloud Service Justification

The project uses four Firebase products on the Spark plan and deliberately declines a
fifth. The table records the role of each service, why it belongs in the cloud rather than
on the SOC VM, its cost at the project's scale, and the risk it introduces.

| Service | Role in project | Why cloud (vs self-hosted) | Cost on Spark plan | Limitation/risk |
|---|---|---|---|---|
| Firebase Auth | Analyst and admin sign-in (email/password plus Google), UID attached to every Firestore request; role stored as a custom claim | Identity is the one component where self-hosting is a net negative: password hashing, reset flows, session revocation and OAuth provider integrations would otherwise be hand-built. Managed auth also gives the security rules a trusted `request.auth` principal | $0 — unlimited email/password and Google sign-ins | 50k monthly active users ceiling is far above lab scale; custom claims must be set with the Admin SDK from the bridge, so the bridge holds identity privileges; no enterprise SSO on Spark |
| Cloud Firestore | Primary alert store: `alerts`, `incidents`, `response_actions`, `audit` collections; drives the SPA through `onSnapshot` | The SPA is static and hosted off-VM, so it needs a store reachable from the browser with per-document authorisation. Firestore supplies realtime listeners, offline cache and row-level security rules that a self-hosted database would require an API tier and custom authz to match | $0 — 1 GiB stored, 50k reads / 20k writes / 20k deletes per day, 10 GiB/month egress | Spark has no automated backups or point-in-time recovery; the 20k writes/day cap bounds sustained alert volume; no server-side aggregation beyond simple counts; listener costs scale with open tabs |
| Firebase Hosting | Serves the React + Vite SPA over HTTPS with a global CDN, single-command deploys | The dashboard must be reachable from outside the lab NAT network. Hosting removes TLS certificate management, CDN configuration and a public reverse proxy that would otherwise sit on the same 6 GB SOC VM already running Wazuh and Splunk | $0 — 10 GB storage, 360 MB/day transfer | 360 MB/day transfer is ample for a demo but would bind a real deployment; no server-side rendering; every deploy is a full upload (no incremental); custom domain requires DNS control |
| Firebase Cloud Messaging (FCM) | Push notification to the analyst's browser for every alert at level ≥10, sent by the bridge via the Admin SDK | Browser push requires a vendor relay that terminates the connection to the browser; there is no self-hosted equivalent that works without a service worker and a push service. FCM is also free, which makes the alternative (a websocket fan-out service on the VM) strictly worse for this use case | $0 — unlimited messages | Requires a service worker and VAPID key; delivery is best-effort, so the UI must still rely on `onSnapshot` as the source of truth; no delivery receipts on the web SDK; token expiry must be handled by re-registration |
| Firebase Cloud Functions — **not used** | Would have hosted the alert-ingest logic (webhook receiver, dedupe, enrichment) | Functions would remove the daemon but require the Blaze plan even at zero usage, because outbound network calls to VirusTotal and the Admin SDK are billable-eligible operations. The self-hosted daemon reuses the machine that already holds the log file | Not available on Spark; Blaze requires a billing account | Also a worse security shape: a public HTTPS endpoint becomes the attack surface, and the function would still need a service account key or a secret |
| Self-hosted bridge daemon (SOC VM, systemd) — **the counter-example** | Tails `alerts.json`, dedupes on `(agent_id, rule_id, timestamp)`, enriches level ≥7 alerts with VirusTotal, writes Firestore, sends FCM for level ≥10, writes `response_actions` | Justified by locality: the alert file is on the same host, so tailing it costs nothing and needs no ingress. It also keeps the VirusTotal API key and the Firebase credential off any public endpoint | $0 incremental — runs inside the already-allocated 6 GB SOC VM | Single point of failure with no HA; the VM must stay up for alerts to reach the cloud; no managed retry/observability beyond journald; credential sits on disk |

## Trade-off discussion points

**Firestore as serverless alert store vs a self-hosted indexer.** Firestore gives realtime
sync, per-document rules and zero operational work, which is exactly what a static SPA
needs. What it does not give is an inverted index: there is no equivalent of
`index=main rule_id=5712 | stats count by src_ip` without either denormalising counters
into documents or paying for many small queries. Splunk remains the analytics engine for
that reason, and Firestore is scoped to the operational state of an alert — status,
assignee, enrichment, notification. The honest framing is that this is a two-store
architecture by design, not a replacement of the SIEM index with a document database.

**Service-account key on the VM vs Workload Identity.** The bridge authenticates with a
  JSON key at `/etc/siem-bridge/sa.json` (mode 640, `root:siem-bridge`, gitignored). This is the
pragmatic choice for a self-hosted daemon outside Google Cloud, but a long-lived key is a
standing credential: it does not expire, it is not bound to the host, and rotation is
manual. Workload Identity Federation would replace it with short-lived tokens issued to a
workload whose identity is attested by the platform (GKE, Cloud Run, or an OIDC-trusted
external workload). The report should state plainly that the key is a lab concession and
that production would use federation.

**Spark vs Blaze.** Spark is genuinely $0 and covers every product used here, but it
removes Cloud Functions, automated Firestore backups, and any guaranteed quota beyond the
daily caps. Blaze would cost effectively nothing at this volume yet would add a billing
account, budget alerts and a failure mode where a misconfigured retry loop turns into a
real invoice. Staying on Spark forces the architecture to be explicit about its own
compute — which is why the bridge exists — and that constraint is itself a defensible
design decision rather than an accident.
