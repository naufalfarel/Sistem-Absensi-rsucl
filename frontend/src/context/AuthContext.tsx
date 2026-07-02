import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthUser, getToken, setToken, clearToken } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (nip: string, username: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await authApi.me();
      if (res.success) {
        setUser(res.data);
      } else {
        handleLogoutLocal();
      }
    } catch {
      handleLogoutLocal();
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getToken();
      if (storedToken) {
        setTokenState(storedToken);
        await fetchProfile();
      }
      setLoading(false);
    };
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogoutLocal = () => {
    setUser(null);
    setTokenState(null);
    clearToken();
  };

  const login = async (nip: string, username: string, pass: string): Promise<boolean> => {
    try {
      const res = await authApi.login(nip, username, pass);
      if (res.success && res.data.token) {
        setToken(res.data.token);
        setTokenState(res.data.token);
        setUser(res.data.user);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      handleLogoutLocal();
    }
  };

  const refreshUser = async () => {
    if (token) {
      await fetchProfile();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
