import { useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLiveCollection } from '../lib/useLiveCollection.js';

const TACTIC_COLORS = ['#3b82f6', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#95a5a6', '#34495e', '#d35400', '#16a085', '#c0392b'];

export default function Dashboards() {
  const alerts = useLiveCollection('alerts', 'firstSeen');

  const volume = useMemo(() => {
    const byHour = new Map();
    for (const a of alerts) {
      const hour = String(a.firstSeen || '').slice(0, 13) + ':00';
      byHour.set(hour, (byHour.get(hour) || 0) + 1);
    }
    return [...byHour.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([hour, count]) => ({ hour, count }));
  }, [alerts]);

  const topRules = useMemo(() => {
    const byRule = new Map();
    for (const a of alerts) {
      const key = `${a.rule_id} ${a.description || ''}`.trim();
      byRule.set(key, (byRule.get(key) || 0) + 1);
    }
    return [...byRule.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 8)
      .map(([rule, count]) => ({ rule: rule.slice(0, 40), count }));
  }, [alerts]);

  const tactics = useMemo(() => {
    const byTactic = new Map();
    for (const a of alerts) {
      const t = a.mitre?.tactic || 'unknown';
      byTactic.set(t, (byTactic.get(t) || 0) + 1);
    }
    return [...byTactic.entries()].map(([name, value]) => ({ name, value }));
  }, [alerts]);

  const agents = useMemo(() => {
    const byAgent = new Map();
    for (const a of alerts) {
      const key = `${a.agent} (${a.agent_id})`;
      const entry = byAgent.get(key) || { agent: key, alerts: 0, maxLevel: 0 };
      entry.alerts += 1;
      entry.maxLevel = Math.max(entry.maxLevel, a.level || 0);
      byAgent.set(key, entry);
    }
    return [...byAgent.values()];
  }, [alerts]);

  return (
    <div className="dashboards">
      <section>
        <h2>Alert volume (per hour)</h2>
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={volume}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section>
        <h2>Top rules</h2>
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topRules} layout="vertical">
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="rule" width={220} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#e67e22" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section>
        <h2>ATT&amp;CK tactics</h2>
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={tactics} dataKey="value" nameKey="name" outerRadius={90} label={false}>
                {tactics.map((entry, i) => (
                  <Cell key={entry.name} fill={TACTIC_COLORS[i % TACTIC_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section>
        <h2>Agent activity</h2>
        <table className="alerts">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Alerts</th>
              <th>Max level</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.agent}>
                <td>{a.agent}</td>
                <td>{a.alerts}</td>
                <td>{a.maxLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
