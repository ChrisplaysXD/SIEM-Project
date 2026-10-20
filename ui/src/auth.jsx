import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const token = await u.getIdTokenResult();
          setRole(token.claims.role || 'analyst');
        } catch {
          setRole('analyst');
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = {
    user,
    role,
    loading,
    isAdmin: role === 'admin',
    loginEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
    loginGoogle: () => signInWithPopup(auth, googleProvider),
    logout: () => signOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
