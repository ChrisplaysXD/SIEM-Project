#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i += 2) {
  flags[args[i]] = args[i + 1];
}

const level = Number(flags['--level'] || 8);
const ruleId = flags['--rule-id'] || String(100000 + Math.floor(Math.random() * 999));
const srcIp = flags['--src-ip'] || `10.66.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`;
const agent = flags['--agent'] || 'test-agent';
const out = flags['--out'] || process.env.ALERTS_PATH || '/tmp/siem-test-alerts.json';

const alert = {
  timestamp: new Date().toISOString(),
  agent: { id: '999', name: agent },
  rule: {
    id: ruleId,
    level,
    description: flags['--description'] || `Synthetic test alert (level ${level})`,
    mitre: { id: ['T1110'], tactic: ['Credential Access'] },
  },
  srcip: srcIp,
  location: 'test-injector',
  full_log: 'synthetic alert injected by inject-test-alert',
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.appendFileSync(out, `${JSON.stringify(alert)}\n`);
console.log(`appended alert to ${out}`);
console.log(JSON.stringify(alert, null, 2));
