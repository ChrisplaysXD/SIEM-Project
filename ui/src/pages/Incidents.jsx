import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { setIncidentStatus } from '../lib/api.js';

export default function Incidents() {
  const { user, isAdmin } = useAuth();
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => setIncidents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  return (
    <div>
      <h2>Incidents</h2>
      <table className="alerts">
        <thead>
          <tr>
            <th>Created</th>
            <th>Title</th>
            <th>Alerts</th>
            <th>Status</th>
            <th>Assigned</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id}>
              <td>{i.createdAt}</td>
              <td>{i.title}</td>
              <td>{(i.alertIds || []).length}</td>
              <td>{i.status}</td>
              <td>{i.assignedTo}</td>
              <td className="actions">
                <button onClick={() => setIncidentStatus(i.id, 'investigating', user.uid)}>Investigate</button>
                <button onClick={() => setIncidentStatus(i.id, 'resolved', user.uid)}>Resolve</button>
                {isAdmin && <button onClick={() => setIncidentStatus(i.id, 'closed', user.uid)}>Close</button>}
              </td>
            </tr>
          ))}
          {incidents.length === 0 && (
            <tr>
              <td colSpan={6}>No incidents yet. Select alerts on the Alerts page to create one.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
