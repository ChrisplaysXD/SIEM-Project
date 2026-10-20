import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAlert, sanitizeDocId } from '../src/normalize.js';

test('sanitizeDocId replaces unsafe chars', () => {
  assert.equal(sanitizeDocId('001:5710:2026-10-20T06:00:00.000+0000'), '001_5710_2026-10-20T06_00_00_000_0000');
});

test('normalizeAlert maps full wazuh shape', () => {
  const raw = {
    timestamp: '2026-10-20T06:00:00.000+0000',
    agent: { id: '001', name: 'ubuntu-agent-01' },
    rule: { id: '5710', level: 10, description: 'sshd brute force', mitre: { id: ['T1110'], tactic: ['Credential Access'] } },
    srcip: '203.0.113.9',
  };
  const a = normalizeAlert(raw);
  assert.equal(a.agent_id, '001');
  assert.equal(a.rule_id, '5710');
  assert.equal(a.level, 10);
  assert.equal(a.mitre.tactic, 'Credential Access');
  assert.equal(a.src_ip, '203.0.113.9');
  assert.equal(a.status, 'new');
  assert.equal(a.assignedTo, null);
});

test('normalizeAlert is deterministic per (agent,rule,timestamp)', () => {
  const raw = { timestamp: '2026-10-20T06:00:00.000+0000', agent: { id: '001' }, rule: { id: '5710', level: 5 } };
  assert.equal(normalizeAlert(raw).id, normalizeAlert({ ...raw }).id);
});

test('normalizeAlert survives missing fields', () => {
  const a = normalizeAlert({});
  assert.equal(a.agent_id, 'unknown');
  assert.equal(a.level, 0);
  assert.ok(a.firstSeen);
});
