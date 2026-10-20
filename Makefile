SHELL := /bin/bash

.PHONY: help setup-config certs compose-up compose-down clean restart inject-test-alert verify demo

help:
	@echo "Targets:"
	@echo "  setup-config      download official Wazuh configs + generate TLS certs"
	@echo "  compose-up        start Wazuh + Splunk + UF (SOC VM only)"
	@echo "  compose-down      stop containers (keeps data volumes)"
	@echo "  clean             stop containers AND wipe data volumes (destructive)"
	@echo "  restart           recreate containers after config changes"
	@echo "  inject-test-alert append a synthetic alert for offline bridge/UI testing"
	@echo "  verify            run the Splunk 500MB/day cap check"
	@echo "  demo              print the end-to-end attack demo walkthrough"

setup-config:
	./provision/soc-vm/setup-config.sh

certs:
	docker compose -f generate-indexer-certs.yml run --rm generator

compose-up:
	docker compose up -d --wait

compose-down:
	docker compose down

restart:
	docker compose down
	docker compose up -d --wait

clean:
	docker compose down -v --remove-orphans
	rm -rf data

inject-test-alert:
	node scripts/inject-test-alert.js

verify:
	@docker exec splunk /opt/splunk/bin/splunk search "index=main earliest=-24h | stats count" -auth admin:SplunkAdmin2026

demo: compose-up
	@echo "=== END-TO-END DEMO ==="
	@echo "1. Agent VM:   ./scripts/demo/bruteforce.sh <soc-ip>"
	@echo "2. Wazuh:      dashboard alert for rules 5710/5712 within ~30s"
	@echo "3. Splunk:     make verify (or index=main earliest=-24h | stats count)"
	@echo "4. Firestore:  alerts/<doc> written by bridge (UI live via onSnapshot)"
	@echo "5. FCM:        push received for level >= 10"
	@echo "6. SOAR:       iptables -L -n on agent shows DROP for attacker IP"
	@echo "Offline UI test: make inject-test-alert (bridge tails /tmp/siem-test-alerts.json)"
