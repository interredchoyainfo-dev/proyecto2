import { api } from '../lib/api';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModuleId, Negocio, ThemeConfig } from '../types';
import { useEspaciosStore } from './useEspaciosStore';
import { useStore } from './useStore';
import { useMesasStore } from './useMesasStore';

export interface TenantFull extends Negocio {
  plan: 'trial' | 'basic' | 'pro' | 'enterprise';
  modulos: Record<ModuleId, boolean>;
  usuariosCount: number;
  mesasCount: number;
  espaciosCount: number;
  lastActive?: string;
  adminUser?: string;
  adminPassword?: string;
}

export const THEME_PRESETS = [
  {
    id: 'superadmin',
    label: 'Púrpura SuperAdmin (SaaS)',
    primaryColor: '#8B5CF6',
    accentColor: '#A78BFA',
    secondaryColor: '#121722',
    previewBg: 'from-violet-600 to-purple-800',
  },
  {
    id: 'gold',
    label: 'Dorado Eléctrico (Original)',
    primaryColor: '#FBBF24',
    accentColor: '#F59E0B',
    secondaryColor: '#EC6A06',
    previewBg: 'from-amber-400 to-yellow-600',
  },
  {
    id: 'emerald',
    label: 'Verde Césped Deportivo',
    primaryColor: '#10B981',
    accentColor: '#34D399',
    secondaryColor: '#059669',
    previewBg: 'from-emerald-500 to-teal-700',
  },
  {
    id: 'blue',
    label: 'Azul Padel Pro',
    primaryColor: '#3B82F6',
    accentColor: '#60A5FA',
    secondaryColor: '#1D4ED8',
    previewBg: 'from-blue-500 to-indigo-700',
  },
  {
    id: 'red',
    label: 'Rojo Fuego & Piel',
    primaryColor: '#EF4444',
    accentColor: '#F87171',
    secondaryColor: '#DC2626',
    previewBg: 'from-red-500 to-rose-700',
  },
];

export const ALL_MODULES: { id: ModuleId; label: string; description: string }[] = [
  { id: 'bar', label: 'Bar / Mesas', description: 'Gestión de mesas, pedidos y salón' },
  { id: 'reservas', label: 'Reservas', description: 'Canchas, turnos y reservas online' },
  { id: 'cocina', label: 'Cocina KDS', description: 'Pantalla de comandas para cocina' },
  { id: 'caja', label: 'Caja', description: 'Apertura, cierre y movimientos de caja' },
  { id: 'inventario', label: 'Inventario', description: 'Stock por sector' },
  { id: 'mozos', label: 'App Mozos', description: 'Comandera móvil para mozos' },
  { id: 'delivery', label: 'Delivery', description: 'Gestión de repartos' },
  { id: 'torneos', label: 'Torneos', description: 'Organización de torneos y fixtures' },
  { id: 'escuela', label: 'Escuela', description: 'Clases y alumnos' },
  { id: 'access_control', label: 'Control de Accesos', description: 'Check-in QR' },
  { id: 'smart_center', label: 'Smart Center IoT', description: 'Luces, barreras y dispositivos' },
  { id: 'finanzas', label: 'Finanzas', description: 'Reportes y P&L' },
  { id: 'empleados', label: 'Empleados', description: 'RRHH y turnos' },
  { id: 'analytics_ai', label: 'Analytics AI', description: 'Predicciones de ocupación' },
];

const initialTenants: TenantFull[] = [
  {
    id: 'giovanni',
    slug: 'giovanni',
    nombre: 'Complejo Giovanni',
    descripcion: 'Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha.',
    theme: {
      primaryColor: '#FBBF24',
      accentColor: '#F59E0B',
      secondaryColor: '#EC6A06',
      preset: 'gold',
    },
    isActive: true,
    createdAt: '2024-01-15',
    plan: 'pro',
    usuariosCount: 12,
    mesasCount: 10,
    espaciosCount: 5,
    lastActive: new Date().toISOString(),
    adminUser: 'admin',
    adminPassword: 'admin',
    modulos: {
      bar: true, reservas: true, cocina: true, caja: true, inventario: true,
      iot: true, analytics_ai: false, delivery: true, mozos: true, escuela: false,
      torneos: true, access_control: true, smart_center: true, finanzas: true, empleados: true,
    },
  },
  {
    id: 'oasispadel',
    slug: 'oasispadel',
    nombre: 'Oasis Padel Club',
    descripcion: 'Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha.',
    theme: {
      primaryColor: '#8B5CF6',
      accentColor: '#A78BFA',
      secondaryColor: '#121722',
      preset: 'superadmin',
    },
    isActive: true,
    createdAt: '2026-03-01',
    plan: 'pro',
    usuariosCount: 5,
    mesasCount: 6,
    espaciosCount: 4,
    lastActive: new Date().toISOString(),
    adminUser: 'oasisadmin',
    adminPassword: 'oasis123',
    modulos: {
      bar: true, reservas: true, cocina: false, caja: true, inventario: false,
      iot: false, analytics_ai: false, delivery: false, mozos: false, escuela: false,
      torneos: true, access_control: false, smart_center: false, finanzas: true, empleados: false,
    },
  },
  {
    id: 'demo',
    slug: 'demo',
    nombre: 'Complejo Demo',
    descripcion: 'Complejo deportivo modelo para demostraciones y entrenamientos.',
    theme: {
      primaryColor: '#3B82F6',
      accentColor: '#60A5FA',
      secondaryColor: '#1D4ED8',
      preset: 'blue',
    },
    isActive: true,
    createdAt: '2025-06-01',
    plan: 'basic',
    usuariosCount: 3,
    mesasCount: 6,
    espaciosCount: 2,
    lastActive: '2026-09-20T10:00:00Z',
    adminUser: 'demoadmin',
    adminPassword: 'demo123',
    modulos: {
      bar: true, reservas: true, cocina: false, caja: true, inventario: false,
      iot: false, analytics_ai: false, delivery: false, mozos: false, escuela: false,
      torneos: false, access_control: false, smart_center: false, finanzas: true, empleados: false,
    },
  },
  {
    id: 'padelpro',
    slug: 'padelpro',
    nombre: 'Padel Pro Center',
    descripcion: 'Centro de alto rendimiento de pádel profesional con canchas panorámicas.',
    theme: {
      primaryColor: '#8B5CF6',
      accentColor: '#A78BFA',
      secondaryColor: '#121722',
      preset: 'superadmin',
    },
    isActive: true,
    createdAt: '2025-03-10',
    plan: 'enterprise',
    usuariosCount: 28,
    mesasCount: 0,
    espaciosCount: 12,
    lastActive: new Date().toISOString(),
    modulos: {
      bar: true, reservas: true, cocina: true, caja: true, inventario: true,
      iot: true, analytics_ai: true, delivery: false, mozos: true, escuela: true,
      torneos: true, access_control: true, smart_center: true, finanzas: true, empleados: true,
    },
  },
  {
    id: 'clubnorte',
    slug: 'clubnorte',
    nombre: 'Club Norte',
    descripcion: 'Club deportivo familiar con canchas de fútbol, pádel y confitería.',
    theme: {
      primaryColor: '#10B981',
      accentColor: '#34D399',
      secondaryColor: '#059669',
      preset: 'emerald',
    },
    isActive: false,
    createdAt: '2024-11-01',
    plan: 'trial',
    usuariosCount: 2,
    mesasCount: 4,
    espaciosCount: 3,
    lastActive: '2026-01-15T08:00:00Z',
    modulos: {
      bar: true, reservas: true, cocina: false, caja: true, inventario: false,
      iot: false, analytics_ai: false, delivery: false, mozos: false, escuela: false,
      torneos: false, access_control: false, smart_center: false, finanzas: false, empleados: false,
    },
  },
];

interface SuperAdminState {
  tenants: TenantFull[];
  modulesCatalog: typeof ALL_MODULES;
  toggleTenantActive: (id: string) => void;
  toggleModule: (tenantId: string, moduleId: ModuleId) => void;
  updatePlan: (tenantId: string, plan: TenantFull['plan']) => void;
  updateTenant: (
    id: string,
    data: Partial<{
      nombre: string;
      slug: string;
      subtitulo: string;
      whatsapp: string;
      plan: TenantFull['plan'];
      descripcion: string;
      theme: ThemeConfig;
      isActive: boolean;
      adminUser: string;
      adminPassword: string;
      modulos: Record<ModuleId, boolean>;
    }>
  ) => void;
  deleteTenant: (id: string) => void;
  resetTenantDataToZero: (id: string) => void;
  createTenant: (data: {
    nombre: string;
    slug: string;
    plan: TenantFull['plan'];
    descripcion?: string;
    theme?: ThemeConfig;
    adminUser?: string;
    adminPassword?: string;
    modulos?: Record<ModuleId, boolean>;
  }) => void;
  getStats: () => {
    totalTenants: number;
    activeTenants: number;
    trialTenants: number;
    totalUsers: number;
  };
}

export const useSuperAdminStore = create<SuperAdminState>()(
  persist(
    (set, get) => ({
      tenants: initialTenants,
      modulesCatalog: ALL_MODULES,

      toggleTenantActive: (id) =>
        set((s) => ({
          tenants: s.tenants.map((t) =>
            t.id === id || t.slug === id ? { ...t, isActive: !t.isActive } : t
          ),
        })),

      toggleModule: (tenantId, moduleId) =>
        set((s) => ({
          tenants: s.tenants.map((t) =>
            t.id === tenantId || t.slug === tenantId
              ? {
                  ...t,
                  modulos: {
                    ...t.modulos,
                    [moduleId]: !t.modulos[moduleId],
                  },
                }
              : t
          ),
        })),

      updatePlan: (tenantId, plan) =>
        set((s) => ({
          tenants: s.tenants.map((t) =>
            t.id === tenantId || t.slug === tenantId ? { ...t, plan } : t
          ),
        })),

      updateTenant: (id, data) =>
        set((s) => ({
          tenants: s.tenants.map((t) =>
            t.id === id || t.slug === id
              ? {
                  ...t,
                  ...data,
                  slug: data.slug
                    ? data.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                    : t.slug,
                }
              : t
          ),
        })),

      deleteTenant: (id) => {
        const tenant = get().tenants.find((t) => t.id === id || t.slug === id);
        if (!tenant || tenant.slug.toLowerCase() === 'giovanni' || tenant.id.toLowerCase() === 'giovanni') {
          return;
        }
        set((s) => ({
          tenants: s.tenants.filter((t) => t.id !== id && t.slug !== id),
        }));
        const slug = tenant.slug.toLowerCase();
        useEspaciosStore.getState().deleteEspaciosByTenant?.(slug);
        useStore.getState().resetTenantData?.(slug);
        useMesasStore.getState().deleteTenantMesas?.(slug);
      },
      resetTenantDataToZero: (id) => {
        const tenant = get().tenants.find((t) => t.id === id || t.slug === id);
        if (!tenant) return;
        const slug = tenant.slug.toLowerCase();
        useStore.getState().resetTenantData?.(slug);
        useMesasStore.getState().resetTenantPedidos?.(slug);
      },

      createTenant: (data) => {
        const id = data.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const exists = get().tenants.some((t) => t.slug === id || t.id === id);
        if (exists) return;

        const defaultMods = data.modulos || ALL_MODULES.reduce((acc, m) => {
          acc[m.id] = ['bar', 'reservas', 'caja'].includes(m.id);
          return acc;
        }, {} as Record<ModuleId, boolean>);

        const defaultTheme: ThemeConfig = data.theme || {
          primaryColor: '#8B5CF6',
          accentColor: '#A78BFA',
          secondaryColor: '#121722',
          preset: 'superadmin',
        };

        const defaultDesc =
          data.descripcion ||
          'Instalaciones de primer nivel. Reservas instantáneas. Gastronomía excepcional. Elevamos tu juego dentro y fuera de la cancha.';

        const adminUser = data.adminUser?.trim() || `admin_${id}`;
        const adminPassword = data.adminPassword?.trim() || `${id}123`;

        // Auto-creación y provisión de base de datos SQLite y Firestore para este negocio
        try {
          api.initTenant(id).catch((err) => console.warn(`[MultiTenant] Error creando SQLite para ${id}:`, err));
          setDoc(doc(firestore, 'negocios', id, 'configuracion', 'general'), {
            nombre: data.nombre,
            slug: id,
            plan: data.plan,
            estado: 'activo',
            createdAt: new Date().toISOString()
          }, { merge: true }).catch((err) => console.warn(`[MultiTenant] Error creando Firestore para ${id}:`, err));
        } catch (e) {
          console.warn('[MultiTenant] Error provisionando tenant:', e);
        }

        set((s) => ({
          tenants: [
            ...s.tenants,
            {
              id,
              slug: id,
              nombre: data.nombre,
              descripcion: defaultDesc,
              theme: defaultTheme,
              isActive: true,
              createdAt: new Date().toISOString().split('T')[0],
              plan: data.plan,
              usuariosCount: 1,
              mesasCount: 0,
              espaciosCount: 0,
              adminUser,
              adminPassword,
              modulos: defaultMods,
              lastActive: new Date().toISOString(),
            },
          ],
        }));
      },

      getStats: () => {
        const { tenants } = get();
        return {
          totalTenants: tenants.length,
          activeTenants: tenants.filter((t) => t.isActive).length,
          trialTenants: tenants.filter((t) => t.plan === 'trial').length,
          totalUsers: tenants.reduce((sum, t) => sum + t.usuariosCount, 0),
        };
      },
    }),
    { name: 'giovanni-superadmin-storage' }
  )
);
