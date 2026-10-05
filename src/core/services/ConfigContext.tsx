import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import type { TenantConfig, ModuleId } from '../../types';

interface ConfigContextType {
  config: TenantConfig | null;
  loading: boolean;
  error: string | null;
  negocioId: string | undefined;
  isModuleActive: (moduleId: ModuleId) => boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

// Mock tenant database
const MOCK_TENANTS: Record<string, TenantConfig> = {
  giovanni: {
    negocio: {
      id: 'giovanni',
      slug: 'giovanni',
      nombre: 'Complejo Giovanni',
      logoUrl: undefined,
      isActive: true,
      createdAt: '2024-01-15',
      theme: {
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
      },
    },
    modulos: {
      bar: true,
      reservas: true,
      cocina: true,
      caja: true,
      inventario: true,
      iot: true,
      analytics_ai: false,
      delivery: true,
      mozos: true,
      escuela: false,
      torneos: true,
      access_control: true,
      smart_center: true,
      finanzas: true,
      empleados: true,
    },
    activeModules: [
      'bar', 'reservas', 'cocina', 'caja', 'inventario', 'iot',
      'delivery', 'mozos', 'torneos', 'access_control', 'smart_center',
      'finanzas', 'empleados'
    ],
    theme: {
      primaryColor: '#10b981',
    },
    openTime: '08:00',
    closeTime: '00:00',
  },
  demo: {
    negocio: {
      id: 'demo',
      slug: 'demo',
      nombre: 'Complejo Demo',
      isActive: true,
      createdAt: '2025-06-01',
      theme: { primaryColor: '#3b82f6' },
    },
    modulos: {
      bar: true,
      reservas: true,
      cocina: false,
      caja: true,
      inventario: false,
      iot: false,
      analytics_ai: false,
      delivery: false,
      mozos: false,
      escuela: false,
      torneos: false,
      access_control: false,
      smart_center: false,
      finanzas: true,
      empleados: false,
    },
    activeModules: ['bar', 'reservas', 'caja', 'finanzas'],
    openTime: '09:00',
    closeTime: '23:00',
  },
};

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { negocioId } = useParams<{ negocioId: string }>();
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!negocioId) {
      setConfig(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Simulate API call
    const timer = setTimeout(() => {
      const tenant = MOCK_TENANTS[negocioId.toLowerCase()];
      if (tenant && tenant.negocio.isActive) {
        setConfig(tenant);

        // Inject theme CSS variables
        if (tenant.theme?.primaryColor) {
          document.documentElement.style.setProperty('--color-primary', tenant.theme.primaryColor);
        }
      } else {
        setError(`El negocio "${negocioId}" no existe o está suspendido.`);
        setConfig(null);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [negocioId]);

  const isModuleActive = (moduleId: ModuleId): boolean => {
    if (!config) return false;
    return config.modulos[moduleId] === true || config.activeModules.includes(moduleId);
  };

  return (
    <ConfigContext.Provider value={{ config, loading, error, negocioId, isModuleActive }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
