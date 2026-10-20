import { createContext, useContext, useEffect, useState } from 'react';
import { store } from './store/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, role: null, loading: true });

  useEffect(() => store.onAuth((s) => setState({ ...s, loading: false })), []);

  const value = {
    user: state.user,
    role: state.role,
    loading: state.loading,
    isAdmin: state.isAdmin,
    isDemo: store.mode === 'demo',
    loginEmail: (email, password) => store.loginEmail(email, password),
    loginGoogle: () => store.loginGoogle(),
    logout: () => store.logout(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
