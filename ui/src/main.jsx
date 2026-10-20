import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Alerts from './pages/Alerts.jsx';
import Incidents from './pages/Incidents.jsx';
import Dashboards from './pages/Dashboards.jsx';
import Layout from './components/Layout.jsx';
import './styles.css';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/alerts" replace />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="dashboards" element={<Dashboards />} />
      </Route>
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
