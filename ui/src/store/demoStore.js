const listeners = {
  alerts: new Set(),
  incidents: new Set(),
  response_actions: new Set(),
};

const authListeners = new Set();
let auditLog = [];

const DEMO_USER = { uid: 'demo-uid', email: 'demo.analyst@lab.local' };
const MINUTE = 60 * 1000;

let role = localStorage.getItem('demo-role') || 'analyst';
let alerts = [];
let incidents = [];
let responses = [];
let streamTimer = null;
let pushListeners = new Set();

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const ago = (minutes) => new Date(Date.now() - minutes * MINUTE).toISOString();

const TEMPLATES = [
  {
    rule_id: '5710', level: 5, description: 'sshd: Attempt to login using a non-existent user',
    mitre: { id: 'T1110.001', tactic: 'Credential Access' }, src: ['185.220.101.34', '45.155.205.233', '203.0.113.9'], weight: 30,
  },
  {
    rule_id: '5712', level: 10, description: 'sshd: brute force trying to get access to the system.',
    mitre: { id: 'T1110.001', tactic: 'Credential Access' }, src: ['185.220.101.34', '45.155.205.233', '203.0.113.9'], weight: 6, soar: true,
  },
  {
    rule_id: '40601', level: 8, description: 'sshd: Possible port scan from a remote host.',
    mitre: { id: 'T1046', tactic: 'Discovery' }, src: ['198.51.100.77', '103.97.3.44'], weight: 14, vt: 42,
  },
  {
    rule_id: '5402', level: 5, description: 'sudo: authentication failure.',
    mitre: { id: 'T1548.003', tactic: 'Privilege Escalation' }, src: [], srcuser: true, weight: 14,
  },
  {
    rule_id: '5405', level: 8, description: 'sudo: 3 or more consecutive failed sudo logins.',
    mitre: { id: 'T1548.003', tactic: 'Privilege Escalation' }, src: [], srcuser: true, weight: 8,
  },
  {
    rule_id: '31103', level: 5, description: 'Web server 400 error code (attempt to bypass security).',
    mitre: { id: 'T1190', tactic: 'Initial Access' }, src: ['192.0.2.140', '203.0.113.201'], weight: 10, vt: 7,
  },
  {
    rule_id: '87105', level: 7, description: 'Linux process running with suspicious name (mimicking kernel thread).',
    mitre: { id: 'T1036.005', tactic: 'Defense Evasion' }, src: [], weight: 6, vt: 31,
  },
  {
    rule_id: '5541', level: 4, description: 'sshd: Service accepted (successful login).',
    mitre: { id: 'T1078', tactic: 'Defense Evasion' }, src: ['203.0.113.9', '198.51.100.12'], weight: 12,
  },
];

const AGENTS = [
  { id: '001', name: 'ubuntu-agent-01' },
  { id: '002', name: 'ubuntu-agent-02' },
  { id: '003', name: 'web-agent-03' },
];

const WEIGHTED = TEMPLATES.flatMap((t) => Array(t.weight).fill(t));

function mkAlert(template, ts) {
  const agent = pick(AGENTS);
  const raw = {
    timestamp: ts,
    agent,
    rule: { id: template.rule_id, level: template.level, description: template.description, mitre: { id: [template.mitre.id], tactic: [template.mitre.tactic] } },
    srcip: template.srcuser ? '' : pick(template.src),
    data: template.srcuser ? { srcuser: pick(['deploy', 'svc-backup', 'chris']) } : {},
  };
  const docId = `${agent.id}_${template.rule_id}_${ts}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const alert = {
    id: docId,
    agent: agent.name,
    agent_id: agent.id,
    rule_id: template.rule_id,
    level: template.level,
    description: template.description,
    mitre: { tactic: template.mitre.tactic, id: template.mitre.id },
    src_ip: raw.srcip,
    status: pick(['new', 'new', 'new', 'ack', 'resolved']),
    assignedTo: null,
    firstSeen: ts,
    updatedAt: ts,
  };
  if (template.vt) {
    alert.vt = { score: template.vt, cached: Math.random() < 0.5 };
  }
  return { alert, template };
}

function emit(name) {
  const sorted = [...alerts].sort((a, b) => (a.firstSeen < b.firstSeen ? 1 : -1));
  listeners[name].forEach((cb) => cb(sorted));
}

function emitResponses() {
  listeners.response_actions.forEach((cb) => cb(responses.map((r) => ({ ...r }))));
}

function emitIncidents() {
  listeners.incidents.forEach((cb) => cb(incidents.map((i) => ({ ...i }))));
}

function seed() {
  for (let i = 0; i < 40; i += 1) {
    const { alert } = mkAlert(pick(WEIGHTED), ago(rand(24 * 60)));
    if (!alerts.some((a) => a.id === alert.id)) {
      alerts.push(alert);
    }
  }
  const brute = alerts.find((a) => a.rule_id === '5712');
  if (brute) {
    responses.push({ triggerAlertId: brute.id, action: 'firewall-drop', src_ip: brute.src_ip, executedAt: brute.firstSeen });
    emitResponses();
  }
  const high = alerts.find((a) => a.level >= 8 && a.status === 'ack');
  if (high) {
    incidents.push({ id: 'demo-incident-1', title: `Investigate ${high.description.slice(0, 30)}`, alertIds: [high.id], status: 'investigating', assignedTo: DEMO_USER.uid, createdAt: high.firstSeen });
    emitIncidents();
  }
  emit('alerts');
}

function inject() {
  const template = pick(WEIGHTED);
  const { alert } = mkAlert(template, new Date().toISOString());
  alerts.push(alert);
  emit('alerts');
  if (template.soar) {
    responses.push({ triggerAlertId: alert.id, action: 'firewall-drop', src_ip: alert.src_ip, executedAt: new Date().toISOString() });
    emitResponses();
  }
  if (alert.level >= 10) {
    pushListeners.forEach((cb) => cb({
      notification: { title: `SIEM alert level ${alert.level}`, body: `${alert.description} (agent ${alert.agent}, rule ${alert.rule_id})` },
    }));
  }
}

function startStream() {
  if (streamTimer) return;
  streamTimer = setInterval(() => {
    if (Math.random() < 0.15) {
      for (let i = 0; i < 4 + rand(4); i += 1) {
        inject();
      }
      setTimeout(() => inject(), 3000);
    } else {
      inject();
    }
  }, 9000);
}

export const demoStore = {
  mode: 'demo',

  onAuth(cb) {
    authListeners.add(cb);
    cb({ user: DEMO_USER, role, isAdmin: role === 'admin' });
    return () => authListeners.delete(cb);
  },

  setRole(next) {
    role = next;
    localStorage.setItem('demo-role', next);
    authListeners.forEach((cb) => cb({ user: DEMO_USER, role, isAdmin: role === 'admin' }));
  },

  loginEmail: () => Promise.resolve({ user: DEMO_USER }),
  loginGoogle: () => Promise.resolve({ user: DEMO_USER }),
  logout: () => Promise.resolve(),

  subscribeCollection(name, orderField, cb) {
    seed();
    startStream();
    listeners[name].add(cb);
    if (name === 'alerts') emit('alerts');
    if (name === 'incidents') emitIncidents();
    if (name === 'response_actions') emitResponses();
    return () => listeners[name].delete(cb);
  },

  async updateAlertStatus(id, status, uid) {
    const alert = alerts.find((a) => a.id === id);
    if (alert) {
      alert.status = status;
      alert.assignedTo = uid || null;
      alert.updatedAt = new Date().toISOString();
      emit('alerts');
    }
    await this.writeAudit(uid, `alert.${status}`, id);
  },

  async assignAlert(id, uid) {
    const alert = alerts.find((a) => a.id === id);
    if (alert) {
      alert.assignedTo = uid;
      alert.updatedAt = new Date().toISOString();
      emit('alerts');
    }
    await this.writeAudit(uid, 'alert.assign', id);
  },

  async writeAudit(uid, action, target) {
    auditLog.push({ id: crypto.randomUUID(), actorUid: uid, action, target, timestamp: new Date().toISOString() });
    if (auditLog.length > 500) auditLog = auditLog.slice(-500);
  },

  async createIncident({ title, alertIds, uid }) {
    const id = crypto.randomUUID();
    incidents.push({ id, title, alertIds, status: 'open', assignedTo: uid, createdAt: new Date().toISOString() });
    emitIncidents();
    await this.writeAudit(uid, 'incident.create', id);
    return id;
  },

  async setIncidentStatus(id, status, uid) {
    const incident = incidents.find((i) => i.id === id);
    if (incident) {
      incident.status = status;
      incident.updatedAt = new Date().toISOString();
      emitIncidents();
    }
    await this.writeAudit(uid, `incident.${status}`, id);
  },

  async registerPush() {
    return null;
  },

  onPush(cb) {
    pushListeners.add(cb);
    return () => pushListeners.delete(cb);
  },
};
