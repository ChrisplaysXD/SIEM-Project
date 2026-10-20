import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { demoStore } from '../store/demoStore.js';
import { PushSetup } from './PushSetup.jsx';

export default function Layout() {
  const { user, role, isAdmin, isDemo, logout } = useAuth();
  return (
    <div className="app">
      {isDemo && (
        <div className="demo-banner">
          DEMO MODE — simulated data, no backend.{' '}
          <a href="/?live=1">Switch to live</a>
          <span className="spacer-inline" />
          Viewing as:
          <button className="role-switch" onClick={() => demoStore.setRole('analyst')} disabled={role === 'analyst'}>
            analyst
          </button>
          <button className="role-switch" onClick={() => demoStore.setRole('admin')} disabled={role === 'admin'}>
            admin
          </button>
        </div>
      )}
      <nav className="nav">
        <span className="brand">SIEM</span>
        <NavLink to="/alerts">Alerts</NavLink>
        <NavLink to="/incidents">Incidents</NavLink>
        <NavLink to="/dashboards">Dashboards</NavLink>
        <span className="spacer" />
        <span className="role">{role || '—'}</span>
        {isAdmin && <span className="badge admin">admin</span>}
        <span className="user">{user?.email}</span>
        <button onClick={logout}>Logout</button>
      </nav>
      <main>
        <Outlet />
      </main>
      <PushSetup />
    </div>
  );
}
