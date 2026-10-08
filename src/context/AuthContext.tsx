import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { useSuperAdminStore } from '../store/useSuperAdminStore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlugOrId?: string) => Promise<boolean>;
  loginWithPin: (pin: string, tenantSlugOrId?: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const MOCK_USERS: (User & { password: string })[] = [
  {
    id: 'u-super',
    negocioId: null,
    email: 'super',
    password: 'admin',
    nombre: 'Super Admin',
    rol: 'superadmin',
    isActive: true,
    pinAcceso: '0000',
  },
  {
    id: 'u-admin',
    negocioId: 'giovanni',
    email: 'admin',
    password: 'admin',
    nombre: 'Admin Giovanni',
    rol: 'admin',
    isActive: true,
    pinAcceso: '1234',
  },
  {
    id: 'u-mozo',
    negocioId: 'giovanni',
    email: 'mozo',
    password: 'admin',
    nombre: 'Carlos Mozo',
    rol: 'mozo',
    isActive: true,
    pinAcceso: '5678',
  },
  {
    id: 'u-cocina',
    negocioId: 'giovanni',
    email: 'cocina',
    password: 'admin',
    nombre: 'Ana Cocina',
    rol: 'cocina',
    isActive: true,
    pinAcceso: '9012',
  },
  {
    id: 'u-delivery',
    negocioId: 'giovanni',
    email: 'delivery',
    password: 'admin',
    nombre: 'Pedro Delivery',
    rol: 'delivery',
    isActive: true,
    pinAcceso: '7890',
  },
  {
    id: 'u-recepcion',
    negocioId: 'giovanni',
    email: 'recepcion',
    password: 'admin',
    nombre: 'Laura Recepción',
    rol: 'recepcion',
    isActive: true,
    pinAcceso: '3456',
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session
    const stored = localStorage.getItem('giovanni-auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch {
        localStorage.removeItem('giovanni-auth');
      }
    }
    setLoading(false);
  }, []);

  const login = async (
    email: string,
    password: string,
    tenantSlugOrId?: string
  ): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. SuperAdmin global check
    if (cleanEmail === 'super' && cleanPass === 'admin') {
      const superUser: User = {
        id: 'u-super',
        negocioId: null,
        email: 'super',
        nombre: 'Super Admin',
        rol: 'superadmin',
        isActive: true,
      };
      setUser(superUser);
      localStorage.setItem('giovanni-auth', JSON.stringify(superUser));
      return true;
    }

    // 2. Specific Tenant credentials check
    if (tenantSlugOrId) {
      const tenants = useSuperAdminStore.getState().tenants;
      const targetTenant = tenants.find(
        (t) =>
          t.slug.toLowerCase() === tenantSlugOrId.toLowerCase() ||
          t.id.toLowerCase() === tenantSlugOrId.toLowerCase()
      );

      if (targetTenant) {
        const expectedUser = (targetTenant.adminUser || 'admin').toLowerCase();
        const expectedPass = targetTenant.adminPassword || 'admin';

        if (cleanEmail === expectedUser && cleanPass === expectedPass) {
          const tenantAdmin: User = {
            id: `admin-${targetTenant.id}`,
            negocioId: targetTenant.slug,
            email: targetTenant.adminUser || 'admin',
            nombre: `Administrador de ${targetTenant.nombre}`,
            rol: 'admin',
            isActive: true,
          };
          setUser(tenantAdmin);
          localStorage.setItem('giovanni-auth', JSON.stringify(tenantAdmin));
          return true;
        }

        // Allow staff of this specific tenant
        const staff = MOCK_USERS.find(
          (u) =>
            u.negocioId?.toLowerCase() === targetTenant.slug.toLowerCase() &&
            u.email.toLowerCase() === cleanEmail &&
            u.password === cleanPass
        );
        if (staff && staff.isActive) {
          const { password: _, ...safeUser } = staff;
          setUser(safeUser);
          localStorage.setItem('giovanni-auth', JSON.stringify(safeUser));
          return true;
        }

        // Credentials did NOT match this specific tenant!
        return false;
      }
    }

    // 3. Fallback for root / login
    const found = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail && u.password === cleanPass
    );
    if (found && found.isActive) {
      const { password: _, ...safeUser } = found;
      setUser(safeUser);
      localStorage.setItem('giovanni-auth', JSON.stringify(safeUser));
      return true;
    }

    return false;
  };

  const loginWithPin = async (
    pin: string,
    tenantSlugOrId?: string
  ): Promise<boolean> => {
    const targetNegocio = tenantSlugOrId?.toLowerCase() || 'giovanni';
    const found = MOCK_USERS.find(
      (u) =>
        u.pinAcceso === pin &&
        u.isActive &&
        (!u.negocioId || u.negocioId.toLowerCase() === targetNegocio)
    );
    if (found) {
      const { password: _, ...safeUser } = found;
      setUser(safeUser);
      localStorage.setItem('giovanni-auth', JSON.stringify(safeUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('giovanni-auth');
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
