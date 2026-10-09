import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { API_BASE_URL } from '../lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, password: string, tenantSlugOrId?: string) => Promise<boolean>;
  loginWithPin: (pin: string, tenantSlugOrId?: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function responseMessage(data: any, status: number): string {
  if (data?.code === 'OWNER_AUTH_NOT_CONFIGURED') {
    return 'El backend está activo, pero falta configurar OWNER_EMAIL y OWNER_PASSWORD en el servidor.';
  }
  if (data?.code === 'OWNER_PIN_NOT_CONFIGURED') {
    return 'El backend está activo, pero falta configurar OWNER_PIN en el servidor.';
  }
  if (data?.code === 'INVALID_CREDENTIALS') {
    return 'Usuario o contraseña incorrectos. Usá las credenciales OWNER configuradas en el backend; las claves demo antiguas ya no son válidas.';
  }
  if (data?.code === 'INVALID_PIN') return 'PIN de SuperAdmin incorrecto.';
  if (data?.message) return data.message;
  return `El servidor rechazó el acceso (HTTP ${status}).`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('giovanni-auth');
    const token = localStorage.getItem('giovanni-token');

    if (stored && token) {
      if (!API_BASE_URL) {
        setLoading(false);
        return;
      }
      try {
        JSON.parse(stored);
        fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error('Token inválido');
          })
          .then((data) => {
            if (data?.user) setUser(data.user);
            else throw new Error('Sin usuario');
          })
          .catch(() => {
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
      if (stored) localStorage.removeItem('giovanni-auth');
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string, tenantSlugOrId?: string): Promise<boolean> => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    if (!API_BASE_URL) {
      const message = 'API no configurada: falta VITE_API_URL en el proyecto de Vercel.';
      setAuthError(message);
      console.error('[Auth]', message);
      return false;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass, negocioId: tenantSlugOrId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('giovanni-auth', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('giovanni-token', data.token);
        return true;
      }

      const message = responseMessage(data, res.status);
      setAuthError(message);
      console.warn('[Auth] Login rechazado:', data.code || res.status, message);
      return false;
    } catch (err) {
      const message = `No se pudo conectar con la API (${API_BASE_URL}). Verificá que el backend esté publicado y accesible.`;
      setAuthError(message);
      console.error('[Auth] Error de red al intentar login:', err);
      return false;
    }
  };

  const loginWithPin = async (pin: string, tenantSlugOrId?: string): Promise<boolean> => {
    setAuthError(null);
    const targetNegocio = tenantSlugOrId?.toLowerCase() || 'superadmin';
    if (!API_BASE_URL) {
      setAuthError('API no configurada: falta VITE_API_URL en el proyecto de Vercel.');
      return false;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, negocioId: targetNegocio }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('giovanni-auth', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('giovanni-token', data.token);
        return true;
      }

      setAuthError(responseMessage(data, res.status));
      console.warn('[Auth] PIN rechazado:', data.code || res.status);
      return false;
    } catch (err) {
      setAuthError(`No se pudo conectar con la API (${API_BASE_URL}). Verificá que el backend esté publicado y accesible.`);
      console.error('[Auth] Error de red al intentar login con PIN:', err);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setAuthError(null);
    localStorage.removeItem('giovanni-auth');
    localStorage.removeItem('giovanni-token');
  };

  const hasRole = (...roles: UserRole[]) => !!user && roles.includes(user.rol);

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, loginWithPin, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
