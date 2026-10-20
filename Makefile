# Makefile — SIEM Cloud Computing Project
# Source of truth: .kilo/plans/1792475736112-siem-firebase-cloud-project.md

.PHONY: init compose-up compose-down inject-test-alert demo clean verify

# Start Wazuh + Splunk containers (SOC VM only — never host)
compose-up:
	docker-compose -f docker-compose.yml up -d wazuh.manager wazuh.indexer wazuh.dashboard splunk

compose-down:
	docker-compose -f docker-compose.yml down -v || true

# Smoke test: inject a synthetic Wazuh alert payload into Firestore (offline UI test)
# This simulates the bridge tail → normalize → write flow.
inject-test-alert:
	@echo "Injecting synthetic test alert (simulates bridge path)..."
	@echo '{"agent":{"id":"test-agent-001","name":"test-agent"},"rule":{"id":"100001","level":8,"description":"Synthetic brute-force test"},"timestamp":"$(shell date -Iseconds)","src_ip":"10.0.0.42","mitre":{"tactic":"TA0006","id":"T1110"}}' > /tmp/test-alert.json
	@echo "Test payload written to /tmp/test-alert.json"
	@echo "Run bridge daemon to push to Firestore, or load manually for UI smoke testing."

# End-to-end demo: runs attack scenario sequence + inject test
# Note: requires agent VM running; containers must be up.
demo: compose-up
	@echo "=== DEMO SEQUENCE ==="
	@echo "1. Verify agent VM is running (Wazuh agent enrolled)."
	@echo "2. Run hydra on agent VM (SSH brute force)."
	@echo "3. Check Wazuh dashboard (<30s alert)."
	@echo "4. Check Splunk: index=main earliest=-24h | stats count"
	@echo "5. Check Firestore alerts collection (via bridge)."
	@echo "6. Verify FCM push (level >= 10) and active response (iptables -L)."
	@echo "=== Run inject-test-alert for offline UI verification ==="

# Verify Splunk cap (< 500MB/day)
verify:
	@echo "Run inside Splunk container or via UF: index=main earliest=-24h | stats count"

# Clean containers and volumes (caution: removes Splunk data)
clean:
	docker-compose -f docker-compose.yml down -v || true
	rm -f /tmp/test-alert.json

# Initialize: git setup, permissions, first commit
init:
	chmod 600 .git/info/* 2>/dev/null || true
	git add -A
	git commit -m "feat: initial repo skeleton (docker-compose, provision, README)" || echo "Nothing to commit."
