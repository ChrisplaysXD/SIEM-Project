import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { PushSetup } from './PushSetup.jsx';

export default function Layout() {
  const { user, role, isAdmin, logout } = useAuth();
  return (
    <div className="app">
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
