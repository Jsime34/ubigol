import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentSession, signIn, signUp, confirmSignUp, signOut, getIdToken } from './auth';

interface AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  confirm: (email: string, code: string) => Promise<void>;
  logout: () => void;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getCurrentSession()
      .then((session) => {
        if (session?.isValid()) {
          setIsAuthenticated(true);
          setEmail(session.getIdToken().payload['email'] as string);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const session = await signIn(email, password);
    setIsAuthenticated(true);
    setEmail(session.getIdToken().payload['email'] as string);
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    await signUp(email, password, firstName, lastName);
  };

  const confirm = async (email: string, code: string) => {
    await confirmSignUp(email, code);
  };

  const logout = () => {
    signOut();
    setIsAuthenticated(false);
    setEmail(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, email, login, register, confirm, logout, getToken: getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
