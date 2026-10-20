import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { setAlertStatus, assignAlert, writeAudit, createIncident, STATUS_VALUES } from '../lib/api.js';

function useLiveCollection(name, orderField) {
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    const q = query(collection(db, name), orderBy(orderField, 'desc'), limit(500));
    const unsub = onSnapshot(q, (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [name, orderField]);
  return docs;
}

function levelClass(level) {
  if (level >= 10) return 'critical';
  if (level >= 7) return 'high';
  if (level >= 4) return 'medium';
  return 'low';
}

export default function Alerts() {
  const { user } = useAuth();
  const alerts = useLiveCollection('alerts', 'firstSeen');
  const responses = useLiveCollection('response_actions', 'executedAt');
  const responseByAlert = new Set(responses.map((r) => r.triggerAlertId));
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState([]);

  const visible = statusFilter === 'all' ? alerts : alerts.filter((a) => a.status === statusFilter);

  async function updateStatus(id, status) {
    await setAlertStatus(id, status, user.uid);
    await writeAudit(user.uid, `alert.${status}`, id);
  }

  async function take(id) {
    await assignAlert(id, user.uid);
    await writeAudit(user.uid, 'alert.assign', id);
  }

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div>
      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span>{visible.length} alerts (live)</span>
        {selected.length > 0 && <span>{selected.length} selected for incident</span>}
      </div>
      <table className="alerts">
        <thead>
          <tr>
            <th />
            <th>Time</th>
            <th>Level</th>
            <th>Rule</th>
            <th>Description</th>
            <th>Agent</th>
            <th>Source IP</th>
            <th>MITRE</th>
            <th>VT</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((a) => (
            <tr key={a.id}>
              <td>
                <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
              </td>
              <td>{a.firstSeen}</td>
              <td>
                <span className={`pill ${levelClass(a.level)}`}>{a.level}</span>
              </td>
              <td>{a.rule_id}</td>
              <td>{a.description}</td>
              <td>{a.agent}</td>
              <td>{a.src_ip}</td>
              <td>{a.mitre?.id || '—'}</td>
              <td>{a.vt ? `${a.vt.score}${a.vt.cached ? ' (cached)' : ''}` : '—'}</td>
              <td>{a.status}</td>
              <td className="actions">
                <button onClick={() => updateStatus(a.id, 'ack')}>Ack</button>
                <button onClick={() => updateStatus(a.id, 'escalate')}>Escalate</button>
                <button onClick={() => updateStatus(a.id, 'resolve')}>Resolve</button>
                <button onClick={() => take(a.id)}>Take</button>
                {responseByAlert.has(a.id) && <span className="badge" title="SOAR firewall-drop executed">auto-responded</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected.length > 0 && <CreateIncident selected={selected} onDone={() => setSelected([])} />}
    </div>
  );
}

function CreateIncident({ selected, onDone }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title) return;
    setBusy(true);
    try {
      await createIncident({ title, alertIds: selected, uid: user.uid });
      setTitle('');
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="toolbar incident-create">
      <input placeholder="Incident title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button disabled={busy || !title} onClick={create}>
        Create incident ({selected.length})
      </button>
    </div>
  );
}
