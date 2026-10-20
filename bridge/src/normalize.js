export function sanitizeDocId(raw) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function normalizeAlert(raw) {
  const timestamp = raw.timestamp || raw["@timestamp"] || new Date().toISOString();
  const rule = raw.rule || {};
  const mitre = rule.mitre || {};
  const docId = sanitizeDocId(`${raw.agent?.id || 'unknown'}-${rule.id || 'norule'}-${timestamp}`);
  return {
    id: docId,
    agent: raw.agent?.name || 'unknown',
    agent_id: raw.agent?.id || 'unknown',
    rule_id: String(rule.id || '0'),
    level: Number(rule.level || 0),
    description: rule.description || '',
    mitre: {
      tactic: mitre.tactic?.[0] || '',
      id: mitre.id?.[0] || '',
    },
    src_ip: raw.srcip || raw.src_ip || '',
    status: 'new',
    assignedTo: null,
    firstSeen: timestamp,
    updatedAt: timestamp,
  };
}
