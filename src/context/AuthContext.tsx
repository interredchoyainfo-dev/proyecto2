import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { API_BASE_URL } from '../lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlugOrId?: string) => Promise<boolean>;
  loginWithPin: (pin: string, tenantSlugOrId?: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión desde localStorage y validar token con el servidor
    const stored = localStorage.getItem('giovanni-auth');
    const token = localStorage.getItem('giovanni-token');

    if (stored && token) {
      try {
        JSON.parse(stored); // Validate stored data is valid JSON
        // Validar token contra el servidor antes de restaurar
        fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error('Token inválido');
          })
          .then((data) => {
            if (data?.user) {
              setUser(data.user);
            } else {
              throw new Error('Sin usuario');
            }
          })
          .catch(() => {
            // Token expirado o inválido → limpiar sesión
            localStorage.removeItem('giovanni-auth');
            localStorage.removeItem('giovanni-token');
            setUser(null);
          })
          .finally(() => setLoading(false));
      } catch {
        localStorage.removeItem('giovanni-auth');
        localStorage.removeItem('giovanni-token');
        setLoading(false);
      }
    } else {
      // Sin sesión almacenada
      if (stored) localStorage.removeItem('giovanni-auth');
      setLoading(false);
    }
  }, []);

  const login = async (
    email: string,
    password: string,
    tenantSlugOrId?: string
  ): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPass,
          negocioId: tenantSlugOrId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('giovanni-auth', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('giovanni-token', data.token);
        return true;
      }

      // El servidor respondió con un error explícito
      console.warn('[Auth] Login rechazado por el servidor:', data.message || res.status);
      return false;
    } catch (err) {
      console.error('[Auth] Error de red al intentar login:', err);
      return false;
    }
  };

  const loginWithPin = async (
    pin: string,
    tenantSlugOrId?: string
  ): Promise<boolean> => {
    const targetNegocio = tenantSlugOrId?.toLowerCase() || 'superadmin';

    try {
      const res = await fetch(`${API_BASE_URL}/auth/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, negocioId: targetNegocio }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('giovanni-auth', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('giovanni-token', data.token);
        return true;
      }

      console.warn('[Auth] PIN rechazado por el servidor:', data.message || res.status);
      return false;
    } catch (err) {
      console.error('[Auth] Error de red al intentar login con PIN:', err);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('giovanni-auth');
    localStorage.removeItem('giovanni-token');
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.rol);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithPin, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
