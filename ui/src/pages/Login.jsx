import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, loading, loginEmail, loginGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (loading) return <div className="center">Loading…</div>;
  if (user) return <Navigate to="/alerts" replace />;

  async function submit(e) {
    e.preventDefault();
    try {
      await loginEmail(email, password);
    } catch (err) {
      setError(err.message);
    }
  }

  async function google() {
    try {
      await loginGoogle();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>SIEM Dashboard</h1>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Sign in</button>
        <button type="button" onClick={google}>Sign in with Google</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
