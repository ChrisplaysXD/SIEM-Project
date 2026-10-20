import fs from 'node:fs';
import admin from 'firebase-admin';
import { loadConfig } from './config.js';
import { loadOffset, saveOffset, readNewLines } from './tailer.js';
import { normalizeAlert } from './normalize.js';
import { createVtEnricher, isIp } from './vt.js';

const config = loadConfig();

function initFirebase() {
  const sa = JSON.parse(fs.readFileSync(config.serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: config.projectId });
}

async function writeResponseAction(db, alert, raw) {
  await db.collection('response_actions').add({
    triggerAlertId: alert.id,
    action: 'firewall-drop',
    src_ip: alert.src_ip,
    agent_id: alert.agent_id,
    rule_id: alert.rule_id,
    executedAt: new Date().toISOString(),
    rawRule: raw.rule?.description || '',
  });
}

async function sendFcm(alert) {
  const message = {
    topic: config.fcmTopic,
    notification: {
      title: `SIEM alert level ${alert.level}`,
      body: `${alert.description} (agent ${alert.agent}, rule ${alert.rule_id})`,
    },
    data: { alertId: alert.id, level: String(alert.level) },
  };
  await admin.messaging().send(message);
}

async function processAlert(db, vt, alert, raw) {
  if (
    config.vtApiKey &&
    alert.level >= config.vtMinLevel &&
    isIp(alert.src_ip) &&
    !isPrivateIp(alert.src_ip)
  ) {
    try {
      const vtResult = await vt.lookup(alert.src_ip);
      alert.vt = { score: vtResult.score, cached: vtResult.cached };
    } catch (err) {
      console.error(JSON.stringify({ event: 'vt_failed', ip: alert.src_ip, error: String(err) }));
    }
  }

  await db.collection('alerts').doc(alert.id).set(alert, { merge: true });

  if (config.responseRuleIds.includes(alert.rule_id) && alert.src_ip) {
    await writeResponseAction(db, alert, raw);
  }

  if (alert.level >= config.fcmMinLevel) {
    await sendFcm(alert);
  }
}

function isPrivateIp(ip) {
  return /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip);
}

async function pollOnce(db, vt) {
  let fromPosition = loadOffset(config.offsetPath);
  const pending = [];
  const result = await readNewLines(config.alertsPath, fromPosition, (raw) => {
    pending.push(raw);
  });
  for (const raw of pending) {
    const alert = normalizeAlert(raw);
    try {
      await processAlert(db, vt, alert, raw);
    } catch (err) {
      console.error(JSON.stringify({ event: 'alert_write_failed', id: alert.id, error: String(err) }));
    }
  }
  if (result.position !== fromPosition) {
    saveOffset(config.offsetPath, result.position);
  }
  if (pending.length > 0 || result.invalid > 0) {
    console.log(JSON.stringify({ event: 'poll', valid: result.valid, invalid: result.invalid }));
  }
}

async function main() {
  initFirebase();
  const db = admin.firestore();
  const vt = createVtEnricher({
    apiKey: config.vtApiKey,
    cacheTtlMs: config.vtCacheTtlMs,
    requestsPerMinute: config.vtRequestsPerMinute,
  });
  console.log(JSON.stringify({ event: 'bridge_started', project: config.projectId }));
  for (;;) {
    try {
      await pollOnce(db, vt);
    } catch (err) {
      console.error(JSON.stringify({ event: 'poll_failed', error: String(err) }));
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ event: 'fatal', error: String(err) }));
  process.exit(1);
});
